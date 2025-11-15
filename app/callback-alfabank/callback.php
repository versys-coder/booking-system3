<?php
declare(strict_types=1);

// Production-friendly defaults
ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// --- 1) Load .env from common candidate locations ---
// Перебираем несколько каталогов, чтобы не "зашивать" путь.
// Порядок: текущая папка скрипта -> /var/www/app/callback-alfabank -> /opt/callback
$envLoaded = false;
$usedEnvDir = null;
$candidateEnvDirs = [
    __DIR__,
    '/var/www/app/callback-alfabank',
    '/opt/callback',
];
foreach ($candidateEnvDirs as $dir) {
    if (is_file($dir . '/.env')) {
        Dotenv::createImmutable($dir)->safeLoad();
        $envLoaded = true;
        $usedEnvDir = $dir;
        break;
    }
}

// --- 2) Read config strictly from $_ENV (not getenv) ---
$baseDir          = __DIR__;
$fastSaleUrl      = $_ENV['FASTSALE_URL']         ?? '';
$clubId           = $_ENV['FASTSALE_CLUB_ID']     ?? '';
$defaultGoodId    = $_ENV['FASTSALE_GOOD_ID']     ?? '';
$apiKey           = $_ENV['FASTSALE_API_KEY']     ?? '';
$userToken        = $_ENV['FASTSALE_USER_TOKEN']  ?? '';
$basicAuth        = $_ENV['FASTSALE_BASIC_AUTH']  ?? '';
$secret           = $_ENV['ALFA_CALLBACK_SECRET'] ?? '';
$requireChecksum  = (strtolower($_ENV['REQUIRE_CHECKSUM'] ?? 'false') === 'true');

$logFile          = $_ENV['LOG_FILE']      ?? ($baseDir . '/logs/callback.log');
$csvFile          = $_ENV['CSV_FILE']      ?? ($baseDir . '/data/payments.csv');
$processedDirEnv  = $_ENV['PROCESSED_DIR'] ?? ($baseDir . '/processed');

// Если PROCESSED_DIR относительный — резолвим относительно скрипта
$processedDir     = (strlen($processedDirEnv) > 0 && $processedDirEnv[0] === '/')
    ? $processedDirEnv
    : ($baseDir . '/' . ltrim($processedDirEnv, '/'));

// 800 рублей = 80000 копеек
const EXPECTED_APPROVED_AMOUNT_KOPEKS = 80000;
const CSV_DELIMITER = ';';

// --- 3) Utilities ---
function write_log(string $msg): void {
    global $logFile, $usedEnvDir, $envLoaded;
    $dir = dirname($logFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0770, true);
    }
    // Разово добавим информацию, откуда взят .env
    static $once = false;
    if (!$once) {
        $once = true;
        $src = $envLoaded ? "using .env from: {$usedEnvDir}" : "no .env found, using defaults/env";
        $msg = "[env] $src | " . $msg;
    }
    $date = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[$date] $msg\n", FILE_APPEND | LOCK_EX);
}

function ensure_dir(string $dir): void {
    if (!is_dir($dir)) {
        @mkdir($dir, 0770, true);
    }
}

function check_checksum(array $params, string $expected_checksum, string $secret): bool {
    unset($params['checksum'], $params['sign_alias']);
    ksort($params);
    $str = '';
    foreach ($params as $k => $v) {
        $str .= "$k;$v;";
    }
    $hmac = strtoupper(hash_hmac('sha256', $str, $secret));
    return $hmac === strtoupper($expected_checksum);
}

function uuidv4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function normalize_phone(?string $raw): string {
    if (!$raw) return '';
    $digits = preg_replace('/\D+/', '', $raw) ?? '';
    if ($digits === '') return '';
    // 8XXXXXXXXXX -> 7XXXXXXXXXX
    if (strlen($digits) === 11 && $digits[0] === '8') {
        return '7' . substr($digits, 1);
    }
    // 10-digit starting with 9 -> prepend 7
    if (strlen($digits) === 10 && $digits[0] === '9') {
        return '7' . $digits;
    }
    // already 11 and starts with 7
    if (strlen($digits) === 11 && $digits[0] === '7') {
        return $digits;
    }
    return $digits;
}

function send_fastsale_payload(array $payload, string $url, array $headers = [], ?string $basicAuth = null): array {
    $ch = curl_init();
    $reqHeaders = array_merge(['Content-Type: application/json'], $headers);
    $opts = [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => $reqHeaders,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FAILONERROR => false,
    ];
    if (!empty($basicAuth) && strpos($basicAuth, ':') !== false) {
        $opts[CURLOPT_USERPWD] = $basicAuth;
    }
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body, 'error' => $err];
}

// --- 4) Start ---
try {
    // Простая проверка что лог/директории доступны
    ensure_dir(dirname($logFile));
    ensure_dir(dirname($csvFile));
    ensure_dir($processedDir);

    // Режим "ping": /callback.php?test=1 — проверка доступности скрипта/логов без побочных действий
    if (isset($_GET['test']) && $_GET['test'] === '1') {
        write_log('TEST MODE: ping OK');
        http_response_code(200);
        header('Content-Type: text/plain; charset=utf-8');
        echo "TEST OK";
        exit;
    }

    // Validate minimal configuration
    if ($fastSaleUrl === '') {
        write_log('ERROR: FASTSALE_URL not configured');
        http_response_code(500);
        echo 'Server misconfigured';
        exit;
    }
    if ($clubId === '') {
        write_log('ERROR: FASTSALE_CLUB_ID not configured');
        http_response_code(500);
        echo 'Server misconfigured';
        exit;
    }
    if ($requireChecksum && $secret === '') {
        write_log('ERROR: REQUIRE_CHECKSUM=true but ALFA_CALLBACK_SECRET empty');
        http_response_code(500);
        echo 'Server misconfigured';
        exit;
    }

    // Log incoming GET but mask checksum
    $safeGet = $_GET;
    if (isset($safeGet['checksum'])) {
        $safeGet['checksum'] = substr((string)$safeGet['checksum'], 0, 6) . '...';
    }
    write_log('FULL GET: ' . print_r($safeGet, true));

    $params = $_GET;

    // Checksum handling
    if ($requireChecksum) {
        if (!isset($params['checksum'])) {
            write_log('ERROR: checksum required but not provided; ignoring callback');
            http_response_code(400);
            echo 'Checksum required';
            exit;
        }
        if (!check_checksum($params, (string)$params['checksum'], $secret)) {
            write_log('ERROR: checksum mismatch; ignoring callback');
            http_response_code(400);
            echo 'Checksum error';
            exit;
        }
    } else {
        if (isset($params['checksum'])) {
            if (!check_checksum($params, (string)$params['checksum'], $secret)) {
                write_log('WARN: checksum present but mismatch (requirement off) - continuing');
            } else {
                write_log('INFO: checksum present and valid (requirement off)');
            }
        } else {
            write_log('WARN: checksum not provided and not required');
        }
    }

    // Extract fields
    $orderNumber       = $params['orderNumber'] ?? '';
    $mdOrder           = $params['mdOrder'] ?? '';
    $operation         = $params['operation'] ?? '';
    $status            = (string)($params['status'] ?? '');
    $approvedAmount    = (int)($params['approvedAmount'] ?? 0); // kopeks
    $ip                = $params['ip'] ?? '';
    $callbackDate      = $params['paymentDate']
        ?? ($params['callbackCreationDate']
        ?? ($params['date'] ?? ''));

    // phone: from Alfa (phone or payerPhone or jsonParams)
    $phoneRaw = $params['phone'] ?? ($params['payerPhone'] ?? '');
    $jsonParams = $params['jsonParams'] ?? '';
    if ($phoneRaw === '' && $jsonParams !== '') {
        $parsed = is_string($jsonParams) ? json_decode($jsonParams, true) : $jsonParams;
        if (is_array($parsed)) {
            $phoneRaw = $parsed['phone'] ?? ($parsed['payerPhone'] ?? '');
        }
    }
    $phone = normalize_phone($phoneRaw);

    // good id: prefer callback-provided good_id / goodId, else env default
    $goodId = $params['good_id'] ?? ($params['goodId'] ?? $defaultGoodId);

    write_log('CALLBACK RECEIVED: ' . http_build_query($params));

    // Idempotency marker (mdOrder + amount + phone)
    $idempKeyRaw = $mdOrder . '|' . $approvedAmount . '|' . $phone;
    $idempKey = hash('sha256', $idempKeyRaw);
    $markerFile = rtrim($processedDir, '/\\') . DIRECTORY_SEPARATOR . $idempKey . '.ok';

    // Conditions: deposited + status 1 + amount == EXPECTED + phone present
    $isSuccessOp = (strtolower($operation) === 'deposited') && ($status === '1');
    $isExpectedAmount = ($approvedAmount === EXPECTED_APPROVED_AMOUNT_KOPEKS);

    if ($isSuccessOp && $isExpectedAmount && $phone !== '') {
        if (file_exists($markerFile)) {
            write_log("SKIP: already processed orderNumber=$orderNumber phone=$phone amount=$approvedAmount");
        } else {
            // Build payload according to example (800 rubles)
            $docId = uuidv4();
            $nowIso = date('Y-m-d\TH:i:s');

            if ($goodId === '') {
                write_log('ERROR: goodId not provided in callback and no FASTSALE_GOOD_ID in env');
                http_response_code(200);
                echo 'OK';
                exit;
            }

            $payload = [
                'club_id' => $clubId,
                'phone' => $phone,
                'sale' => [
                    'goods' => [
                        [
                            'id' => $goodId,
                            'qnt' => 1,
                            'summ' => 800 // rubles
                        ]
                    ],
                    'cashless' => 800, // rubles
                    'docId' => $docId,
                    'date' => $nowIso
                ]
            ];

            // Prepare headers
            $headers = [];
            if ($apiKey !== '')    $headers[] = 'apikey: ' . $apiKey;
            if ($userToken !== '') $headers[] = 'usertoken: ' . $userToken;

            $resp = send_fastsale_payload($payload, $fastSaleUrl, $headers, $basicAuth);
            $code = $resp['code'];
            $body = (string)($resp['body'] ?? '');
            $err  = (string)($resp['error'] ?? '');

            // Write to CSV
            $row = [
                $callbackDate,
                $orderNumber,
                $mdOrder,
                $phone,
                $approvedAmount,
                $ip,
                $docId,
                $code
            ];
            $fp = @fopen($csvFile, 'a');
            if ($fp) {
                fputcsv($fp, $row, CSV_DELIMITER);
                fclose($fp);
            } else {
                write_log("ERROR: Cannot open CSV file $csvFile for writing");
            }

            // Log send result
            write_log("FASTSALE SENT: docId=$docId phone=$phone payload=" . json_encode($payload, JSON_UNESCAPED_UNICODE) . " http=$code err=" . ($err ?: 'none') . " resp=" . mb_substr($body, 0, 1000));

            if ($code >= 200 && $code < 300) {
                @file_put_contents($markerFile, json_encode(['docId' => $docId, 'sent_at' => date('c')]));
            } else {
                write_log("FASTSALE FAILED for orderNumber=$orderNumber; will allow retry on next callback");
            }
        }
    } else {
        if ($phone === '') {
            write_log("IGNORED: phone empty");
        } elseif (!$isSuccessOp) {
            write_log("IGNORED: operation=$operation status=$status (not success)");
        } elseif (!$isExpectedAmount) {
            write_log("IGNORED: approvedAmount=$approvedAmount (expected " . EXPECTED_APPROVED_AMOUNT_KOPEKS . ")");
        } else {
            write_log("IGNORED: unknown reason");
        }
    }

    http_response_code(200);
    echo 'OK';
} catch (Throwable $e) {
    write_log('FATAL: ' . $e->getMessage());
    http_response_code(500);
    echo 'Internal error';
}