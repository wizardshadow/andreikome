<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const CMS_ROOT = __DIR__ . '/../../cms';
const WEB_ROOT = __DIR__ . '/../../';
const COOKIE = 'andreiko_cms';

function json_out($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function fail(string $message, int $status = 400): void {
  json_out(['error' => $message], $status);
}

function read_json_file(string $path): ?array {
  if (!is_file($path)) return null;
  $raw = file_get_contents($path);
  if ($raw === false || $raw === '') return null;
  $data = json_decode($raw, true);
  return is_array($data) ? $data : null;
}

function write_json_file(string $path, $data): void {
  $dir = dirname($path);
  if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    fail('Не удалось создать каталог хранилища', 500);
  }
  $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
  if ($json === false || file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
    @unlink($tmp);
    fail('Не удалось записать данные', 500);
  }
  if (!rename($tmp, $path)) {
    @unlink($tmp);
    fail('Не удалось сохранить данные', 500);
  }
}

function load_config(): array {
  $path = CMS_ROOT . '/config.php';
  if (!is_file($path)) fail('CMS не настроена: отсутствует cms/config.php', 503);
  $config = require $path;
  if (!is_array($config) || empty($config['password_hash']) || empty($config['session_secret'])) {
    fail('CMS не настроена: проверьте cms/config.php', 503);
  }
  $config['owner_email'] = $config['owner_email'] ?? 'wsandreiko@gmail.com';
  $config['session_ttl'] = (int)($config['session_ttl'] ?? 60 * 60 * 24 * 14);
  return $config;
}

function defaults_content(): array {
  $js = file_get_contents(WEB_ROOT . 'content-defaults.js');
  if ($js === false) fail('Не найден content-defaults.js', 500);
  if (!preg_match('/window\.SITE_DEFAULTS\s*=\s*(\{.*\})\s*;?\s*$/s', $js, $m)) {
    fail('Некорректный content-defaults.js', 500);
  }
  $data = json_decode($m[1], true);
  if (!is_array($data)) fail('Не удалось разобрать content-defaults.js', 500);
  return $data;
}

function safe_js_json($value): string {
  $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) fail('Не удалось сериализовать контент', 500);
  return str_replace(['<', "\u{2028}", "\u{2029}"], ['\\u003c', '\\u2028', '\\u2029'], $json);
}

function publish_static(array $content): void {
  $js = 'window.SITE_DEFAULTS=' . safe_js_json($content) . ";\n";
  $path = WEB_ROOT . 'content-defaults.js';
  $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
  if (file_put_contents($tmp, $js, LOCK_EX) === false || !rename($tmp, $path)) {
    @unlink($tmp);
    fail('Не удалось опубликовать content-defaults.js', 500);
  }
}

function uuid(): string {
  $b = random_bytes(16);
  $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
  $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
  $h = bin2hex($b);
  return substr($h, 0, 8) . '-' . substr($h, 8, 4) . '-' . substr($h, 12, 4) . '-' . substr($h, 16, 4) . '-' . substr($h, 20);
}

function b64url(string $raw): string {
  return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function b64url_decode(string $value): string|false {
  $pad = 4 - (strlen($value) % 4);
  if ($pad < 4) $value .= str_repeat('=', $pad);
  return base64_decode(strtr($value, '-_', '+/'), true);
}

function issue_session(array $config): string {
  $payload = [
    'email' => $config['owner_email'],
    'exp' => time() + $config['session_ttl'],
    'nonce' => bin2hex(random_bytes(8)),
  ];
  $body = b64url(json_encode($payload, JSON_UNESCAPED_UNICODE));
  $sig = b64url(hash_hmac('sha256', $body, $config['session_secret'], true));
  return $body . '.' . $sig;
}

function set_session_cookie(string $token, array $config): void {
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  setcookie(COOKIE, $token, [
    'expires' => time() + $config['session_ttl'],
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
}

function clear_session_cookie(): void {
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  setcookie(COOKIE, '', [
    'expires' => time() - 3600,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
}

function current_user(array $config): ?array {
  $token = $_COOKIE[COOKIE] ?? '';
  if (!$token || !str_contains($token, '.')) return null;
  [$body, $sig] = explode('.', $token, 2);
  $expect = b64url(hash_hmac('sha256', $body, $config['session_secret'], true));
  if (!hash_equals($expect, $sig)) return null;
  $raw = b64url_decode($body);
  if ($raw === false) return null;
  $payload = json_decode($raw, true);
  if (!is_array($payload) || empty($payload['email']) || empty($payload['exp']) || time() > (int)$payload['exp']) {
    return null;
  }
  if (strcasecmp((string)$payload['email'], (string)$config['owner_email']) !== 0) return null;
  return ['id' => 'mchost-owner', 'email' => $config['owner_email']];
}

function require_user(array $config): array {
  $user = current_user($config);
  if (!$user) fail('Войдите в админку', 401);
  return $user;
}

function require_same_origin(): void {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin === '') return;
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? '';
  $expected = $scheme . '://' . $host;
  if (!hash_equals($expected, $origin)) fail('Недопустимый источник запроса', 403);
}

function published_record(): array {
  $data = read_json_file(CMS_ROOT . '/published.json');
  if ($data && isset($data['content']) && is_array($data['content'])) return $data;
  return ['revision' => null, 'createdAt' => null, 'content' => defaults_content()];
}

function draft_record(): array {
  $live = published_record();
  $draft = read_json_file(CMS_ROOT . '/draft.json');
  if ($draft && isset($draft['content']) && is_array($draft['content'])) return $draft;
  return ['revision' => null, 'createdAt' => null, 'content' => $live['content']];
}

function snapshot(): array {
  $live = published_record();
  return [
    'draft' => draft_record(),
    'published' => [
      'revision' => $live['revision'] ?? null,
      'createdAt' => $live['createdAt'] ?? null,
    ],
  ];
}

function validate_content($input): array {
  if (!is_array($input)) fail('Некорректный JSON контента');
  $template = defaults_content();
  $max = ['services' => 12, 'navigation' => 8, 'slides' => 20, 'socials' => 12, 'directions' => 8, 'items' => 30, 'steps' => 12];

  $allowed_url = function (string $value): bool {
    if ($value === '') return true;
    if (preg_match('/[\\x00-\\x20<>\"\'\\\\]/', $value) || str_starts_with($value, '//')) return false;
    if (preg_match('#^(mailto:|tel:)#i', $value)) return true;
    if (preg_match('#^https://#i', $value)) return true;
    if (preg_match('#^(/|assets/)#', $value)) return !str_contains($value, '..');
    return false;
  };

  $visit = function ($value, $template, string $path) use (&$visit, $max, $allowed_url) {
    if (is_array($template) && array_is_list($template)) {
      if (!is_array($value) || !array_is_list($value)) fail('Некорректный список: ' . $path);
      $key = ($path === '' ? '' : basename(str_replace('.', '/', $path)));
      $parts = $path === '' ? [] : explode('.', $path);
      $leaf = $parts ? end($parts) : '';
      $limit = $max[$leaf] ?? 30;
      if (count($value) > $limit) fail('Некорректный список: ' . $path);
      $itemTemplate = $template[0] ?? [];
      $out = [];
      foreach ($value as $i => $item) $out[] = $visit($item, $itemTemplate, $path . '.' . $i);
      return $out;
    }
    if (is_array($template)) {
      if (!is_array($value) || array_is_list($value)) fail('Некорректный раздел: ' . $path);
      $out = [];
      foreach ($template as $key => $child) {
        $childPath = $path === '' ? $key : $path . '.' . $key;
        if (!array_key_exists($key, $value)) {
          $out[$key] = $visit($child, $child, $childPath);
          continue;
        }
        $out[$key] = $visit($value[$key], $child, $childPath);
      }
      return $out;
    }
    $isNumber = static fn($v) => is_int($v) || is_float($v);
    if ($isNumber($template) && $isNumber($value)) {
      if (!is_finite((float)$value)) fail('Некорректное число: ' . $path);
      if (str_starts_with($path, 'effects.')) {
        $key = substr($path, strlen('effects.'));
        $range = match ($key) {
          'grainOpacity' => [0, 0.3],
          'videoScale' => [30, 100],
          'videoDim' => [0, 100],
          default => [80, 5000],
        };
        if ($value < $range[0] || $value > $range[1]) fail('Значение вне допустимого диапазона: ' . $path);
      }
      // Keep integer fields integer when the JSON number is whole.
      if (is_int($template) && (float)$value === (float)(int)$value) return (int)$value;
      return $value;
    }
    if (gettype($value) !== gettype($template)) fail('Некорректный тип: ' . $path);
    if (is_string($value)) {
      if (strlen($value) > 12000) fail('Слишком длинный текст: ' . $path);
      if (preg_match('/\.(image|thumbnail|cardImage|preview|video|portrait|cursor|telegram|caseUrl|url|background)$/', $path) && !$allowed_url($value)) {
        fail('Недопустимая ссылка: ' . $path);
      }
      if ($path === 'meta.accent' && !preg_match('/^#[0-9a-f]{6}$/i', $value)) fail('Цвет должен иметь формат #RRGGBB');
    }
    return $value;
  };

  $c = $visit($input, $template, '');
  if (!is_string($c['meta']['title'] ?? null) || trim($c['meta']['title']) === '' || empty($c['hero']['slides'])) {
    fail('Укажите название сайта и хотя бы один слайд');
  }
  $initial = $c['hero']['initialSlide'] ?? null;
  if (!is_int($initial) || $initial < 0 || $initial >= count($c['hero']['slides'])) {
    fail('Выберите существующий начальный слайд');
  }
  foreach ($c['hero']['slides'] as $slide) {
    if (empty($slide['image']) || !is_string($slide['title'] ?? null) || trim($slide['title']) === '') {
      fail('У каждого слайда должны быть название и изображение');
    }
  }
  foreach ($c['works']['items'] as $item) {
    if (!is_string($item['title'] ?? null) || trim($item['title']) === '' || empty($item['preview'])) {
      fail('У каждой работы должны быть название и превью');
    }
  }
  return $c;
}

function save_draft(array $content, $baseRevision, array $user): array {
  $previous = read_json_file(CMS_ROOT . '/draft.json');
  $prevRev = $previous['revision'] ?? null;
  if (($prevRev ?? null) !== ($baseRevision ?? null)) {
    fail('Черновик изменён в другой вкладке. Обновите страницу перед сохранением.', 409);
  }
  $draft = [
    'revision' => uuid(),
    'createdAt' => gmdate('c'),
    'actor' => $user['id'],
    'content' => validate_content($content),
  ];
  write_json_file(CMS_ROOT . '/draft.json', $draft);
  return $draft;
}

function request_json(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') fail('Пустое тело запроса');
  $data = json_decode($raw, true);
  if (!is_array($data)) fail('Некорректный JSON в теле запроса');
  return $data;
}

function route_path(): string {
  if (isset($_GET['path'])) return trim((string)$_GET['path'], '/');
  $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
  if (preg_match('#/api/admin(?:/index\.php)?(?:/(.*))?$#', $uri, $m)) {
    return trim($m[1] ?? '', '/');
  }
  return '';
}

function handle_upload(array $user): array {
  $type = explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0];
  $map = [
    'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/gif' => 'gif',
    'image/avif' => 'avif', 'image/svg+xml' => 'svg', 'video/mp4' => 'mp4', 'audio/mpeg' => 'mp3',
  ];
  if (!isset($map[$type])) fail('Поддерживаются PNG, JPG, WEBP, GIF, AVIF, SVG, MP4 и MP3');
  $ext = $map[$type];
  $limit = 25 * 1024 * 1024;
  $data = file_get_contents('php://input');
  if ($data === false || $data === '' || strlen($data) > $limit) fail('Файл пустой или превышает 25 МБ', 413);
  $head = substr($data, 0, 200);
  $valid = match ($ext) {
    'png' => ord($data[0]) === 137 && str_contains($head, 'PNG'),
    'jpg' => ord($data[0]) === 255 && ord($data[1]) === 216,
    'webp' => str_starts_with($head, 'RIFF') && str_contains($head, 'WEBP'),
    'gif' => str_starts_with($head, 'GIF8'),
    'mp4', 'avif' => str_contains($head, 'ftyp'),
    'mp3' => str_starts_with($head, 'ID3') || ord($data[0]) === 255,
    default => true,
  };
  if (!$valid) fail('Содержимое файла не соответствует формату');
  if ($ext === 'svg') {
    if (!preg_match('/<svg[\s>]/i', $data) || preg_match('/<script|<foreignObject|on\w+\s*=|javascript:|<!ENTITY|<\?xml-stylesheet|(?:href|src)\s*=\s*[\"\'](?!#)/i', $data)) {
      fail('SVG содержит неподдерживаемые активные элементы');
    }
  }
  $id = uuid();
  $name = 'Файл';
  try {
    $name = substr(rawurldecode($_SERVER['HTTP_X_FILE_NAME'] ?? 'Файл'), 0, 200) ?: 'Файл';
  } catch (Throwable $e) {}
  $rel = 'media/' . $id . '.' . $ext;
  $abs = WEB_ROOT . $rel;
  if (!is_dir(dirname($abs)) && !mkdir(dirname($abs), 0755, true) && !is_dir(dirname($abs))) {
    fail('Не удалось создать каталог media', 500);
  }
  if (file_put_contents($abs, $data, LOCK_EX) === false) fail('Не удалось сохранить файл', 500);
  $item = [
    'id' => $id,
    'name' => $name,
    'url' => '/' . $rel,
    'type' => $type,
    'size' => strlen($data),
    'createdAt' => gmdate('c'),
  ];
  write_json_file(CMS_ROOT . '/uploads/' . $id . '.json', $item);
  return $item;
}

try {
  if (!is_dir(CMS_ROOT)) @mkdir(CMS_ROOT, 0755, true);
  $config = load_config();
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  $path = route_path();

  if ($method !== 'GET' && $method !== 'HEAD') require_same_origin();

  if ($path === 'login' && $method === 'POST') {
    $input = request_json();
    $password = (string)($input['password'] ?? '');
    if ($password === '' || !password_verify($password, $config['password_hash'])) {
      usleep(250000);
      fail('Неверный пароль', 401);
    }
    $token = issue_session($config);
    set_session_cookie($token, $config);
    json_out(['user' => ['email' => $config['owner_email']], 'storage' => true]);
  }

  if ($path === 'logout' && $method === 'POST') {
    clear_session_cookie();
    json_out(['ok' => true]);
  }

  $user = require_user($config);

  if ($path === 'session' && $method === 'GET') {
    json_out(['user' => ['email' => $user['email']], 'storage' => true, 'auth' => 'password']);
  }

  if ($path === 'content' && $method === 'GET') json_out(snapshot());

  if ($path === 'content' && $method === 'PUT') {
    $input = request_json();
    $draft = save_draft($input['content'] ?? null, $input['baseRevision'] ?? null, $user);
    json_out(['draft' => $draft, 'published' => snapshot()['published']]);
  }

  if ($path === 'publish' && $method === 'POST') {
    $input = request_json();
    $draft = read_json_file(CMS_ROOT . '/draft.json');
    if (!$draft || ($draft['revision'] ?? null) !== ($input['revision'] ?? null)) {
      fail('Сохраните актуальный черновик перед публикацией', 409);
    }
    $live = [
      'revision' => uuid(),
      'createdAt' => gmdate('c'),
      'actor' => $user['id'],
      'content' => validate_content($draft['content']),
    ];
    write_json_file(CMS_ROOT . '/history/' . $live['revision'] . '.json', $live);
    write_json_file(CMS_ROOT . '/published.json', $live);
    publish_static($live['content']);
    json_out(['revision' => $live['revision'], 'createdAt' => $live['createdAt']]);
  }

  if ($path === 'history' && $method === 'GET') {
    $dir = CMS_ROOT . '/history';
    $items = [];
    if (is_dir($dir)) {
      foreach (glob($dir . '/*.json') ?: [] as $file) {
        $record = read_json_file($file);
        if ($record && !empty($record['revision']) && !empty($record['createdAt'])) {
          $items[] = ['revision' => $record['revision'], 'createdAt' => $record['createdAt']];
        }
      }
    }
    usort($items, fn($a, $b) => strcmp($b['createdAt'], $a['createdAt']));
    json_out(['items' => array_slice($items, 0, 50)]);
  }

  if ($path === 'restore' && $method === 'POST') {
    $input = request_json();
    $rev = (string)($input['revision'] ?? '');
    if (!preg_match('/^[\da-f-]{36}$/', $rev)) fail('Некорректная версия');
    $record = read_json_file(CMS_ROOT . '/history/' . $rev . '.json');
    if (!$record) fail('Версия не найдена', 404);
    $draft = save_draft($record['content'], $input['baseRevision'] ?? null, $user);
    json_out(['draft' => $draft, 'published' => snapshot()['published']]);
  }

  if ($path === 'media' && $method === 'POST') {
    json_out(handle_upload($user), 201);
  }

  if ($path === 'media' && $method === 'GET') {
    $dir = CMS_ROOT . '/uploads';
    $items = [];
    if (is_dir($dir)) {
      foreach (glob($dir . '/*.json') ?: [] as $file) {
        $item = read_json_file($file);
        if ($item) $items[] = $item;
      }
    }
    usort($items, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));
    json_out(['items' => $items]);
  }

  if (preg_match('#^media/([\da-f-]{36})$#', $path, $m) && $method === 'DELETE') {
    $id = $m[1];
    $metaPath = CMS_ROOT . '/uploads/' . $id . '.json';
    $record = read_json_file($metaPath);
    if (!$record) fail('Файл не найден', 404);
    $state = snapshot();
    $blob = json_encode($state['draft']['content'], JSON_UNESCAPED_UNICODE) . json_encode(published_record()['content'], JSON_UNESCAPED_UNICODE);
    if (str_contains($blob, $record['url'])) fail('Файл используется в черновике или опубликованном сайте', 409);
    $file = WEB_ROOT . ltrim($record['url'], '/');
    if (is_file($file)) @unlink($file);
    @unlink($metaPath);
    json_out(['ok' => true]);
  }

  fail('Не найдено', 404);
} catch (Throwable $e) {
  json_out(['error' => 'Не удалось выполнить операцию. Повторите попытку.'], 500);
}
