<?php
declare(strict_types=1);

const CMS_ROOT = __DIR__ . '/../../cms';
const WEB_ROOT = __DIR__ . '/../../';
const COOKIE = 'andreiko_cms';

function b64url_decode_preview(string $value): string|false {
  $pad = 4 - (strlen($value) % 4);
  if ($pad < 4) $value .= str_repeat('=', $pad);
  return base64_decode(strtr($value, '-_', '+/'), true);
}

function preview_user(array $config): ?array {
  $token = $_COOKIE[COOKIE] ?? '';
  if (!$token || !str_contains($token, '.')) return null;
  [$body, $sig] = explode('.', $token, 2);
  $expect = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, $config['session_secret'], true)), '+/', '-_'), '=');
  if (!hash_equals($expect, $sig)) return null;
  $raw = b64url_decode_preview($body);
  if ($raw === false) return null;
  $payload = json_decode($raw, true);
  if (!is_array($payload) || empty($payload['email']) || empty($payload['exp']) || time() > (int)$payload['exp']) return null;
  if (strcasecmp((string)$payload['email'], (string)$config['owner_email']) !== 0) return null;
  return ['email' => $config['owner_email']];
}

$configPath = CMS_ROOT . '/config.php';
if (!is_file($configPath)) {
  http_response_code(503);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'CMS не настроена';
  exit;
}
$config = require $configPath;
$config['owner_email'] = $config['owner_email'] ?? 'wsandreiko@gmail.com';
if (!preview_user($config)) {
  http_response_code(401);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Войдите в админку';
  exit;
}

$draft = null;
if (is_file(CMS_ROOT . '/draft.json')) {
  $draft = json_decode((string)file_get_contents(CMS_ROOT . '/draft.json'), true);
}
$content = is_array($draft['content'] ?? null) ? $draft['content'] : null;
if (!$content && is_file(CMS_ROOT . '/published.json')) {
  $published = json_decode((string)file_get_contents(CMS_ROOT . '/published.json'), true);
  $content = is_array($published['content'] ?? null) ? $published['content'] : null;
}
if (!$content) {
  $js = (string)file_get_contents(WEB_ROOT . 'content-defaults.js');
  if (preg_match('/window\.SITE_DEFAULTS\s*=\s*(\{.*\})\s*;?\s*$/s', $js, $m)) {
    $content = json_decode($m[1], true);
  }
}
if (!is_array($content)) {
  http_response_code(500);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Нет контента для предпросмотра';
  exit;
}

$html = file_get_contents(WEB_ROOT . 'index.html');
if ($html === false) {
  http_response_code(500);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Не найден index.html';
  exit;
}
$json = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$json = str_replace(['<', "\u{2028}", "\u{2029}"], ['\\u003c', '\\u2028', '\\u2029'], $json);
$inject = '<script>window.SITE_CONTENT=' . $json . '</script>';
if (str_contains($html, '<!-- cms-content -->')) {
  $html = str_replace('<!-- cms-content -->', $inject, $html);
} else {
  $html = str_replace('<script src="content.js"></script>', $inject . '<script src="content.js"></script>', $html);
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('X-Frame-Options: SAMEORIGIN');
echo $html;
