<?php
/**
 * Copy to ../../cms/config.php on the static host (mchost) and set a password hash.
 * Generate hash: php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
 */
return [
  'owner_email' => 'wsandreiko@gmail.com',
  'password_hash' => '$2y$10$replace_with_password_hash___________________________',
  'session_secret' => 'replace_with_long_random_hex',
  'session_ttl' => 60 * 60 * 24 * 14,
];
