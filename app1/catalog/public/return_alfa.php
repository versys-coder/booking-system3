<?php
// catalog/public/return_alfa.php
//
// Страница возврата из Альфа-банка.
// Задачи:
//   - взять orderId / mdOrder из query
//   - показать "Оплата успешно прошла / не прошла"
//   - дернуть локальный backend /catalog/api-backend/api/pay/status
//   - при наличии back_url — вернуть пользователя назад через несколько секунд

$orderId =
  $_GET['orderId'] ??
  $_GET['order_id'] ??
  $_GET['mdOrder'] ??
  $_GET['mdorder'] ??
  '';

$backUrl = isset($_GET['back_url']) ? $_GET['back_url'] : '';

?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Статус оплаты — DVVS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
      background: #0f172a;
      color: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #020617;
      border-radius: 16px;
      padding: 24px 20px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.7);
      text-align: center;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 22px;
    }
    p {
      margin: 6px 0;
      font-size: 14px;
      color: #e5e7eb;
    }
    .status-ok {
      color: #4ade80;
      font-weight: 600;
      margin-top: 8px;
    }
    .status-bad {
      color: #f97373;
      font-weight: 600;
      margin-top: 8px;
    }
    .small {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 10px;
    }
    .btn {
      display: inline-block;
      margin-top: 14px;
      padding: 10px 18px;
      border-radius: 999px;
      background: #f97316;
      color: #0f172a;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Статус оплаты</h1>

    <?php if (!$orderId): ?>
      <p>Не передан идентификатор заказа.</p>
    <?php else: ?>
      <p>Проверяем статус заказа в банке…</p>
      <p class="small">Идентификатор заказа: <b><?php echo htmlspecialchars($orderId, ENT_QUOTES, 'UTF-8'); ?></b></p>
    <?php endif; ?>

    <p id="statusText" class="status-ok" style="display:none;"></p>
    <p id="statusError" class="status-bad" style="display:none;"></p>

    <?php if ($backUrl): ?>
      <a
        id="backLink"
        class="btn"
        href="<?php echo htmlspecialchars($backUrl, ENT_QUOTES, 'UTF-8'); ?>"
      >
        Вернуться на сайт
      </a>
      <p class="small" id="redirectNote" style="display:none;">
        Мы автоматически вернём вас назад через несколько секунд…
      </p>
    <?php endif; ?>
  </div>

  <?php if ($orderId): ?>
  <script>
    (function () {
      var orderId = <?php echo json_encode($orderId); ?>;
      var backUrl = <?php echo json_encode($backUrl); ?>;
      var statusTextEl = document.getElementById("statusText");
      var statusErrEl = document.getElementById("statusError");
      var redirectNoteEl = document.getElementById("redirectNote");

      function setOk(msg) {
        if (statusErrEl) statusErrEl.style.display = "none";
        if (statusTextEl) {
          statusTextEl.textContent = msg;
          statusTextEl.style.display = "block";
        }
      }

      function setErr(msg) {
        if (statusTextEl) statusTextEl.style.display = "none";
        if (statusErrEl) {
          statusErrEl.textContent = msg;
          statusErrEl.style.display = "block";
        }
      }

      if (!orderId) {
        setErr("Не указан идентификатор заказа.");
        return;
      }

      fetch("/catalog/api-backend/api/pay/status?orderId=" + encodeURIComponent(orderId), {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      })
        .then(function (r) { return r.text(); })
        .then(function (txt) {
          var data;
          try {
            data = txt ? JSON.parse(txt) : null;
          } catch (e) {
            setErr("Некорректный ответ сервера: " + txt.slice(0, 200));
            return;
          }

          if (!data || data.ok === false) {
            var msg =
              (data && (data.message || data.errorMessage)) ||
              "Не удалось получить статус оплаты.";
            setErr(msg);
            return;
          }

          if (data.paid) {
            setOk("Оплата успешно получена. Ждём вас!");
            if (backUrl) {
              if (redirectNoteEl) redirectNoteEl.style.display = "block";
              setTimeout(function () {
                window.location.href = backUrl;
              }, 4000);
            }
          } else {
            setErr("Оплата не подтверждена банком. Если деньги списаны — обратитесь, пожалуйста, на ресепшен.");
          }
        })
        .catch(function (e) {
          setErr("Ошибка при обращении к серверу: " + (e && e.message ? e.message : e));
        });
    })();
  </script>
  <?php endif; ?>
</body>
</html>
