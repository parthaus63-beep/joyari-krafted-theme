(function () {
  'use strict';

  var theme = window.JoyariTheme || {};

  function stripTags(value) {
    return String(value || '').replace(/<[^>]*>/g, '');
  }

  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = precision == null ? 2 : precision;
    thousands = thousands || ',';
    decimal = decimal || '.';

    if (isNaN(number) || number == null) return '0';

    var fixed = (number / 100).toFixed(precision);
    var parts = fixed.split('.');
    var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    return dollars + (parts[1] ? decimal + parts[1] : '');
  }

  function formatMoney(cents) {
    if (!theme.moneyFormat) return '$' + formatWithDelimiters(cents, 2);

    var format = theme.moneyFormat;
    var placeholder = format.match(/\{\{\s*(\w+)\s*\}\}/);
    var amount;

    switch (placeholder && placeholder[1]) {
      case 'amount_no_decimals':
        amount = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        amount = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        amount = formatWithDelimiters(cents, 0, '.', ',');
        break;
      default:
        amount = formatWithDelimiters(cents, 2);
        break;
    }

    return stripTags(format.replace(/\{\{\s*\w+\s*\}\}/, amount));
  }

  function checked(root, selector) {
    return root.querySelector(selector + ':checked');
  }

  function text(root, selector, value) {
    root.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  function readChoice(input, fallback) {
    if (!input) return fallback;

    return {
      label: input.value || fallback.label,
      handle: input.getAttribute('data-jkrb-shape') || input.getAttribute('data-jkrb-setting') || input.getAttribute('data-jkrb-metal') || fallback.handle,
      adjustment: parseInt(input.getAttribute('data-price-adjustment'), 10) || 0
    };
  }

  function updateSelectedCards(root) {
    root.querySelectorAll('[data-jkrb-card]').forEach(function (card) {
      var input = card.querySelector('input');
      card.classList.toggle('is-selected', Boolean(input && input.checked));
    });
  }

  function updateLink(link, payload) {
    if (!link) return;

    try {
      var url = new URL(link.getAttribute('href') || '/pages/contact', window.location.origin);
      url.searchParams.set('ring_shape', payload.shape);
      url.searchParams.set('ring_setting', payload.setting);
      url.searchParams.set('ring_metal', payload.metal);
      url.searchParams.set('ring_carat', payload.carat);
      url.searchParams.set('ring_estimate', payload.estimatedPrice);
      link.href = url.pathname + url.search + url.hash;
    } catch (error) {
      return;
    }
  }

  function initBuilder(root) {
    var basePrice = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    var baseCarat = parseFloat(root.getAttribute('data-base-carat')) || 1.5;
    var quarterPremium = parseInt(root.getAttribute('data-quarter-premium'), 10) || 0;
    var caratInput = root.querySelector('[data-jkrb-carat]');
    var payloadField = root.querySelector('[data-jkrb-payload]');
    var requestLinks = root.querySelectorAll('[data-jkrb-request-link], [data-jkrb-request-link-secondary], [data-jkrb-sticky-link]');
    var consultationLinks = root.querySelectorAll('[data-jkrb-consultation-link]');

    function update() {
      var shape = readChoice(checked(root, '[data-jkrb-shape]'), { label: 'Round', handle: 'round', adjustment: 0 });
      var setting = readChoice(checked(root, '[data-jkrb-setting]'), { label: 'Solitaire', handle: 'solitaire', adjustment: 0 });
      var metal = readChoice(checked(root, '[data-jkrb-metal]'), { label: 'Platinum', handle: 'platinum', adjustment: 0 });
      var carat = caratInput ? parseFloat(caratInput.value) || baseCarat : baseCarat;
      var quarters = Math.max(0, Math.round((carat - 1) / 0.25));
      var caratAdjustment = quarters * quarterPremium;
      var estimate = Math.max(0, basePrice + shape.adjustment + setting.adjustment + metal.adjustment + caratAdjustment);
      var formattedEstimate = formatMoney(estimate);
      var caratText = carat.toFixed(2) + ' ct';
      var summary = shape.label + ' ' + setting.label.toLowerCase() + ' in ' + metal.label;

      root.setAttribute('data-current-shape', shape.handle);
      root.setAttribute('data-current-setting', setting.handle);
      root.setAttribute('data-current-metal', metal.handle);

      updateSelectedCards(root);
      text(root, '[data-jkrb-selected-shape]', shape.label);
      text(root, '[data-jkrb-selected-setting]', setting.label);
      text(root, '[data-jkrb-selected-metal]', metal.label);
      text(root, '[data-jkrb-selected-carat]', caratText);
      text(root, '[data-jkrb-carat-output]', caratText);
      text(root, '[data-jkrb-summary]', summary);
      text(root, '[data-jkrb-price]', formattedEstimate);
      text(root, '[data-jkrb-sticky-price]', formattedEstimate);

      var payload = {
        source: 'joyari-custom-ring-builder',
        apiReady: true,
        shape: shape.label,
        shapeHandle: shape.handle,
        setting: setting.label,
        settingHandle: setting.handle,
        metal: metal.label,
        metalHandle: metal.handle,
        carat: caratText,
        estimatedPrice: formattedEstimate,
        estimatedPriceCents: estimate,
        demoData: true
      };

      if (payloadField) payloadField.value = JSON.stringify(payload, null, 2);
      requestLinks.forEach(function (link) { updateLink(link, payload); });
      consultationLinks.forEach(function (link) { updateLink(link, payload); });

      window.JoyariCustomRingSelection = payload;
      root.dispatchEvent(new CustomEvent('joyari:custom-ring:update', {
        bubbles: true,
        detail: payload
      }));
    }

    root.querySelectorAll('[data-jkrb-choice]').forEach(function (input) {
      input.addEventListener('change', update);
      input.addEventListener('input', update);
    });

    update();
  }

  function init() {
    document.querySelectorAll('[data-custom-ring-builder]').forEach(initBuilder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
