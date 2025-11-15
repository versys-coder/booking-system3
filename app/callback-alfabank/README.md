# Callback Альфа-Банк → FastSale

Назначение: принимает callback от Альфа-Банка и, при успешной оплате на фиксированную сумму, инициирует POST-запрос в FastSale для создания продажи.

## Поток
1. Альфа вызывает `GET /callback.php` с параметрами.
2. Скрипт валидирует конфиг, опционально проверяет HMAC checksum.
3. Извлекает телефон: `phone` или `payerPhone` или из `jsonParams`.
4. Условие отправки в FastSale:
   - `operation=deposited`
   - `status=1`
   - `approvedAmount` == 80000 (копеек) — это 800 руб.
   - телефон найден (не пустой)
5. Формирует payload и отправляет в FastSale.
6. Пишет запись в CSV и лог. Ставит маркер идемпотентности.

## Установка
- Путь скрипта (рекомендуется): `/var/www/app/callback-alfabank/callback.php`
- `.env` рядом со скриптом (или в `/var/www/app/callback-alfabank`, или в `/opt/callback`).

Скрипт сам ищет `.env` по путям:
- текущая папка скрипта
- `/var/www/app/callback-alfabank`
- `/opt/callback`

## .env
Обязательные:
- `FASTSALE_URL` — endpoint FastSale
- `FASTSALE_CLUB_ID` — club_id
- `FASTSALE_GOOD_ID` — товар по умолчанию (если не приходит в callback)
- `ALFA_CALLBACK_SECRET` — callback token (нужен для checksum при включении)

Опциональные:
- `FASTSALE_API_KEY`, `FASTSALE_USER_TOKEN`, `FASTSALE_BASIC_AUTH` — заголовки/базовая авторизация в FastSale
- `REQUIRE_CHECKSUM` — `true|false` (по умолчанию false)
- `LOG_FILE` — путь к логу (по умолчанию `./logs/callback.log`)
- `CSV_FILE` — путь к CSV (по умолчанию `./data/payments.csv`)
- `PROCESSED_DIR` — директория маркеров идемпотентности (по умолчанию `./processed`)

## Apache
Если DocumentRoot = `/var/www/html/wordpress`, а скрипт вне этого каталога, добавьте Alias:

Вариант A — сохранить URL `/callback.php`:
```
Alias /callback.php /var/www/app/callback-alfabank/callback.php
<Files /var/www/app/callback-alfabank/callback.php>
    Require all granted
    SetHandler application/x-httpd-php
</Files>
```

Вариант B — отдать всей директорией:
```
Alias /callback-alfabank/ /var/www/app/callback-alfabank/
<Directory /var/www/app/callback-alfabank/>
    Require all granted
    Options -Indexes +FollowSymLinks
    AllowOverride None
    <FilesMatch "\.php$">
        SetHandler application/x-httpd-php
    </FilesMatch>
</Directory>
```

Перезагрузите Apache: `sudo systemctl reload apache2`.

## Права
Рекомендуемые пути (и значения в `.env`):
- `LOG_FILE=/var/www/app/callback-alfabank/logs/callback.log`
- `CSV_FILE=/var/www/app/callback-alfabank/data/payments.csv`
- `PROCESSED_DIR=/var/www/app/callback-alfabank/processed`

Команды:
```
sudo mkdir -p /var/www/app/callback-alfabank/{logs,data,processed}
sudo touch /var/www/app/callback-alfabank/logs/callback.log /var/www/app/callback-alfabank/data/payments.csv
sudo chown -R www-data:www-data /var/www/app/callback-alfabank
sudo chmod 640 /var/www/app/callback-alfabank/.env
sudo chmod 660 /var/www/app/callback-alfabank/logs/callback.log /var/www/app/callback-alfabank/data/payments.csv
sudo chmod 770 /var/www/app/callback-alfabank/processed
```

Если указываете пути внутри WordPress, удостоверьтесь, что каталоги существуют и доступны пользователю `www-data`.

## Тестирование
- Пинг (без побочных действий):  
  `GET /callback.php?test=1` → ответ `TEST OK`, в логах `TEST MODE: ping OK`.
- Симуляция успешного платежа без checksum (если `REQUIRE_CHECKSUM=false`):
```
curl -G "https://<host>/callback.php" \
  --data-urlencode "operation=deposited" \
  --data-urlencode "status=1" \
  --data-urlencode "approvedAmount=80000" \
  --data-urlencode "phone=79991234567" \
  --data-urlencode "orderNumber=manual-test-1" \
  --data-urlencode "mdOrder=manual-md-1"
```
- Через `jsonParams`:
```
curl -G "https://<host>/callback.php" \
  --data-urlencode "operation=deposited" \
  --data-urlencode "status=1" \
  --data-urlencode "approvedAmount=80000" \
  --data-urlencode 'jsonParams={"phone":"79991234567"}'
```

## Логи/CSV
- Лог: `LOG_FILE`
- CSV: `CSV_FILE` (разделитель `;`). Столбцы: `callbackDate, orderNumber, mdOrder, phone, approvedAmount, ip, docId, httpCode`.

## Траблшутинг
- `Server misconfigured` — проверьте, что выставлены `FASTSALE_URL`, `FASTSALE_CLUB_ID` и (если checksum включен) `ALFA_CALLBACK_SECRET`.
- `IGNORED: phone empty` — в callback нет `phone`/`payerPhone`/`jsonParams.phone`.
- `IGNORED: approvedAmount=...` — сумма не равна `80000` (копеек).
- Нет записи в CSV — проверьте права на файл/каталог.
- FastSale 4xx/5xx — проверьте заголовки `apikey`, `usertoken`, `basic auth`, корректность `club_id`, `good id`.