<?php
declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use Dotenv\Dotenv;
use Mpdf\Mpdf;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;
use chillerlan\QRCode\QROptions;
use chillerlan\QRCode\QRCode;

// ---- helpers ----
function respond(bool $ok, string $message = '', array $extra = []): void {
    http_response_code($ok ? 200 : 400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['ok' => $ok, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}
function uuid_v4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
function safe_getenv(string $key, string $fallback = ''): string {
    $v = getenv($key);
    if ($v !== false && $v !== null) return (string)$v;
    if (array_key_exists($key, $_ENV) && $_ENV[$key] !== null) return (string)$_ENV[$key];
    return $fallback;
}
function log_debug(string $msg): void {
    $logPath = safe_getenv('LOG_PATH', __DIR__ . '/../../purchase.log');
    @file_put_contents($logPath, '[' . date('c') . '] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// ---- load .env ----
function load_env(): void {
    $envPath = '/opt/catalog';
    if (is_dir($envPath) && is_readable($envPath . '/.env')) {
        try { $dotenv = Dotenv::createImmutable($envPath); $dotenv->safeLoad(); } catch (Throwable $e) {}
        foreach ($_ENV as $k => $v) if ($v !== null && $v !== '') putenv("$k=$v");
    }
}
load_env();

function normalize_rub($v): int {
    $s = (string)$v;
    $s = str_replace(["\xC2\xA0", "\xA0", ' '], '', $s);
    $s = str_replace(',', '.', $s);
    if ($s === '' || !preg_match('/^-?\d+(\.\d+)?$/', $s)) return 0;
    return (int)round((float)$s, 0);
}

// ---- read request ----
$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) respond(false, 'Invalid JSON body');

$serviceId      = (string)($data['service_id'] ?? $data['serviceId'] ?? $data['id'] ?? '');
$serviceNameIn  = (string)($data['service_name'] ?? $data['serviceName'] ?? '');
$phone          = (string)($data['phone'] ?? '');
$email          = (string)($data['email'] ?? '');
$priceInput     = $data['price'] ?? null;
$visits         = $data['visits'] ?? null;
$freezing       = $data['freezing'] ?? null;

if ($serviceId === '' || $phone === '' || $email === '') {
    respond(false, 'Missing required fields (service_id, phone, email)');
}

// Санитизация service_name (убираем &quot; и невидимые символы)
$serviceNameRaw = html_entity_decode($serviceNameIn, ENT_QUOTES | ENT_HTML5, 'UTF-8');
$serviceNameRaw = preg_replace('/[\x00-\x1F\x7F\x{200B}-\x{200D}\x{FEFF}]+/u', ' ', $serviceNameRaw);
$serviceNameRaw = trim(preg_replace('/\s+/u', ' ', $serviceNameRaw));
$serviceEsc = htmlspecialchars($serviceNameRaw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

// ---- config from env ----
$FASTSALE_ENDPOINT     = safe_getenv('FASTSALE_ENDPOINT', safe_getenv('FASTSALES_ENDPOINT', ''));
$CLUB_ID               = safe_getenv('CLUB_ID', '');
$PUBLIC_BASE           = rtrim(safe_getenv('PUBLIC_BASE', ''), '/');
$VOUCHERS_DIR          = rtrim(safe_getenv('VOUCHERS_DIR', __DIR__ . '/../../vouchers'), '/');
$VOUCHER_SECRET        = safe_getenv('VOUCHER_SECRET', safe_getenv('SECRET', 'please-change-me'));
$API_USER_TOKEN        = safe_getenv('API_USER_TOKEN', '');
$API_KEY               = safe_getenv('API_KEY', '');
$BASIC_USER            = safe_getenv('BASIC_USER', '');
$BASIC_PASS            = safe_getenv('BASIC_PASS', '');

// SMTP
$SMTP_HOST       = safe_getenv('SMTP_HOST', '');
$SMTP_PORT       = intval(safe_getenv('SMTP_PORT', '0'));
$SMTP_USER       = safe_getenv('SMTP_USER', '');
$SMTP_PASS       = safe_getenv('SMTP_PASS', '');
$SMTP_FROM       = safe_getenv('SMTP_FROM', 'noreply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
$SMTP_FROM_NAME  = safe_getenv('SMTP_FROM_NAME', 'DVVS');

// ---- doc & date ----
$docId = uuid_v4();
$date  = (new DateTime('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d\TH:i:s');

// ---- prepare request to external system ----
$normalizedPhone = preg_replace('/\D+/', '', $phone);
$priceRub = normalize_rub($priceInput);

$requestBody = [
    'club_id' => $CLUB_ID,
    'phone'   => $normalizedPhone,
    'sale'    => [
        'docId'    => $docId,
        'date'     => $date,
        'cashless' => $priceRub,
        'goods'    => [[ 'id' => $serviceId, 'qnt' => 1, 'summ' => $priceRub ]]
    ]
];

// ---- send request ----
$headers = ['Content-Type: application/json'];
if ($API_USER_TOKEN !== '') $headers[] = 'usertoken: ' . $API_USER_TOKEN;
if ($API_KEY !== '')        $headers[] = 'apikey: ' . $API_KEY;
if ($BASIC_USER !== '' || $BASIC_PASS !== '') $headers[] = 'Authorization: Basic ' . base64_encode($BASIC_USER . ':' . $BASIC_PASS);

$ch = curl_init($FASTSALE_ENDPOINT);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($requestBody, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_FOLLOWLOCATION => true,
]);
if (filter_var(safe_getenv('DISABLE_SSL_VERIFY', '0'), FILTER_VALIDATE_BOOLEAN)) {
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
}
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 0;
$curlErr  = curl_error($ch) ?: '';
curl_close($ch);

log_debug("External HTTP={$httpCode} err={$curlErr} resp=" . substr((string)$response, 0, 1000));
if ($response === false || $httpCode >= 400) {
    respond(false, 'FastSales error: ' . ($curlErr ?: ('HTTP ' . $httpCode)));
}
$fastsalesResp = json_decode((string)$response, true);
if (json_last_error() === JSON_ERROR_NONE && isset($fastsalesResp['ok']) && $fastsalesResp['ok'] === false) {
    respond(false, 'FastSales error: ' . ($fastsalesResp['message'] ?? 'FastSales returned error'), ['raw' => $fastsalesResp]);
}

// ---- paths & public URL ----
if (!is_dir($VOUCHERS_DIR)) @mkdir($VOUCHERS_DIR, 0755, true);
$voucherFile = $VOUCHERS_DIR . '/' . $docId . '.pdf';
$publicBase = $PUBLIC_BASE !== '' ? $PUBLIC_BASE : (
    ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http')
    . '://' . ($_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost'))
);
$publicVoucherUrlBase = rtrim($publicBase, '/') . '/catalog/api-backend/api/voucher.php?doc=' . urlencode($docId);

// ---- choose template (wave with background if exists) ----
$tplWave = __DIR__ . '/../templates/voucher_a6_wave.html';
$templatePath = is_readable($tplWave)
    ? $tplWave
    : (__DIR__ . '/../templates/voucher_mpdf.html');

$htmlTpl = is_readable($templatePath)
    ? file_get_contents($templatePath)
    : "<html><body><h1>Абонемент</h1><p>Документ: {{docId}}</p><p>Услуга: {{service_name}}</p></body></html>";

// ---- background image absolute file:// path ----
$bgFile = __DIR__ . '/../templates/voucher_a6_bg.png';
$bgSrc = '';
if (is_readable($bgFile)) {
    $bgSrc = 'file://' . str_replace('\\', '/', realpath($bgFile));
} else {
    log_debug('Background image not found: ' . $bgFile);
}

// ---- QR: white modules, transparent bg ----
$qrDataUri = '';
try {
    $options = new QROptions([
        'version'          => 5,
        'outputType'       => QRCode::OUTPUT_IMAGE_PNG,
        'eccLevel'         => QRCode::ECC_Q,
        'scale'            => 6,
        'imageBase64'      => false,
        'bgColor'          => [0, 0, 0, 127], // прозрачный фон (PNG), 127=макс. альфа для GD
        'fgColor'          => [255, 255, 255], // белые модули
        'imageTransparent' => true,
        'addQuietzone'     => true,
        'margin'           => 2,
    ]);
    $qrBin = (new QRCode($options))->render($normalizedPhone);
    $qrDataUri = 'data:image/png;base64,' . base64_encode($qrBin);
} catch (Throwable $e) {
    log_debug('QR generation error: ' . $e->getMessage());
}

// ---- replace placeholders ----
$replacements = [
    '{{bg_src}}'       => $bgSrc,
    '{{docId}}'        => htmlspecialchars($docId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{date}}'         => htmlspecialchars($date, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{service_name}}' => $serviceEsc,
    '{{price}}'        => htmlspecialchars((string)$priceRub, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{visits}}'       => htmlspecialchars((string)$visits, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{freezing}}'     => htmlspecialchars((string)$freezing, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{phone}}'        => htmlspecialchars($phone, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{email}}'        => htmlspecialchars($email, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
    '{{qr_code_data}}' => $qrDataUri,
    '{{voucher_url}}'  => htmlspecialchars($publicVoucherUrlBase, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
];
$voucherHtml = strtr($htmlTpl, $replacements);

// ---- render PDF (A6, single page) ----
$pdfCreated = false;
try {
    $tmpDir = safe_getenv('TMP_DIR', __DIR__ . '/../../tmp');
    if (!is_dir($tmpDir)) @mkdir($tmpDir, 0755, true);
    if (is_file($voucherFile)) @unlink($voucherFile);

    $mpdf = new Mpdf([
        'tempDir'      => $tmpDir,
        'format'       => [105, 148], // A6 (мм)
        'margin_left'  => 0,
        'margin_right' => 0,
        'margin_top'   => 0,
        'margin_bottom'=> 0,
        'default_font' => 'dejavusans',
    ]);
    $mpdf->simpleTables = true;
    $mpdf->SetDisplayMode('fullpage');
    $mpdf->SetAutoPageBreak(true, 0);
    $mpdf->shrink_tables_to_fit = 1.0;
    $mpdf->keep_table_proportions = true;
    $mpdf->showImageErrors = true; // важен для отладки путей

    $mpdf->SetTitle('Абонемент ' . $docId);
    $mpdf->WriteHTML($voucherHtml);
    $mpdf->Output($voucherFile, \Mpdf\Output\Destination::FILE);
    $pdfCreated = is_file($voucherFile);

    if ($pdfCreated) {
        $pdfContent = @file_get_contents($voucherFile);
        $pages = $pdfContent ? substr_count($pdfContent, '/Type /Page') : 0;
        log_debug("PDF pages (heuristic)={$pages}");
    }
} catch (Throwable $e) {
    error_log('mPDF error: ' . $e->getMessage());
    log_debug('mPDF error: ' . $e->getMessage());
    $pdfCreated = false;
}

// ---- Save metadata ----
$metaPath = $VOUCHERS_DIR . '/' . $docId . '.json';
$metaContent = json_encode([
    'doc' => $docId,
    'email' => $email,
    'phone' => $normalizedPhone,
    'service' => $serviceId,
    'price' => $priceRub,
    'created' => date('c')
], JSON_UNESCAPED_UNICODE);
@file_put_contents($metaPath, $metaContent, LOCK_EX);
@chmod($metaPath, 0644);

// ---- public url with token ----
$token = hash_hmac('sha256', $docId . '|' . $email, $VOUCHER_SECRET);
$voucherPublicWithToken = $publicVoucherUrlBase . '&token=' . $token;

// ---- email ----
$mailSent = false;
try {
    $mail = new PHPMailer(true);
    if ($SMTP_HOST !== '') {
        $mail->isSMTP();
        $mail->Host = $SMTP_HOST;
        if ($SMTP_PORT > 0) $mail->Port = $SMTP_PORT;
        if ($SMTP_USER !== '') { $mail->SMTPAuth = true; $mail->Username = $SMTP_USER; $mail->Password = $SMTP_PASS; }
        $enc = strtolower(safe_getenv('SMTP_ENC', safe_getenv('MAIL_ENC', '')));
        if ($enc === 'tls') $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        if ($enc === 'ssl') $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    }
    $mail->CharSet = 'UTF-8';
    $mail->Encoding = 'base64';
    $mail->setFrom($SMTP_FROM, $SMTP_FROM_NAME);
    $mail->addAddress($email);
    $mail->Subject = 'Ваш абонемент — ' . $serviceNameRaw;
    $mail->isHTML(true);
    $mail->Body = '<p>Здравствуйте!</p>'
        . '<p>Спасибо за покупку: <strong>' . htmlspecialchars($serviceNameRaw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</strong></p>'
        . '<p>Документ: <strong>' . htmlspecialchars($docId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</strong></p>'
        . '<p>Ссылка для скачивания ваучера: <a href="' . htmlspecialchars($voucherPublicWithToken, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">скачать ваучер</a></p>';
    $mail->AltBody = 'Спасибо за покупку. Ссылка на ваучер: ' . $voucherPublicWithToken;

    if ($pdfCreated && is_readable($voucherFile)) $mail->addAttachment($voucherFile, 'abonement-' . $docId . '.pdf');
    $mail->send();
    $mailSent = true;
} catch (MailException $e) {
    error_log('PHPMailer error: ' . $e->getMessage());
    log_debug('PHPMailer error: ' . $e->getMessage());
    $mailSent = false;
}

// ---- final log ----
@file_put_contents(
    safe_getenv('LOG_PATH', __DIR__ . '/../../purchase.log'),
    sprintf("[%s] doc=%s service=%s phone=%s email=%s fastsales_http=%d mail=%s pdf=%s\n",
        date('Y-m-d H:i:s'), $docId, $serviceId, $normalizedPhone, $email, $httpCode, $mailSent ? 'ok' : 'no', $pdfCreated ? 'ok' : 'no'
    ),
    FILE_APPEND | LOCK_EX
);

// ---- response ----
respond(true, 'Покупка зарегистрирована', [
    'voucher_url' => $voucherPublicWithToken,
    'doc' => $docId
]);