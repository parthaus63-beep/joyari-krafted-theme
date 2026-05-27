(function () {
  'use strict';

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

  function formatMoney(cents, moneyFormat) {
    if (!moneyFormat) return '$' + formatWithDelimiters(cents, 2);

    var placeholder = moneyFormat.match(/\{\{\s*(\w+)\s*\}\}/);
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

    return stripTags(moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, amount));
  }

  function activeOption(root, group) {
    return root.querySelector('[data-jk3d-option][data-group="' + group + '"].is-active');
  }

  function optionData(option, fallback) {
    if (!option) return fallback;

    return {
      value: option.getAttribute('data-value') || fallback.value,
      label: option.getAttribute('data-label') || fallback.label,
      adjustment: parseInt(option.getAttribute('data-adjustment'), 10) || 0
    };
  }

  function setText(root, selector, value) {
    root.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  function updateLink(link, payload) {
    if (!link) return;

    try {
      var url = new URL(link.getAttribute('href') || '/pages/contact', window.location.origin);
      url.searchParams.set('ring_metal', payload.metal);
      url.searchParams.set('ring_shape', payload.shape);
      url.searchParams.set('ring_setting', payload.setting);
      url.searchParams.set('ring_estimate', payload.estimatedPrice);
      link.href = url.pathname + url.search + url.hash;
    } catch (error) {
      return;
    }
  }

  function initModel(root) {
    var model = root.querySelector('[data-jk3d-model]');

    if (!model) {
      root.classList.add('is-model-loaded');
      return;
    }

    model.addEventListener('load', function () {
      root.classList.add('is-model-loaded');
      root.classList.remove('is-model-error');
    });

    model.addEventListener('error', function () {
      root.classList.add('is-model-error');
      root.classList.remove('is-model-loaded');
    });
  }

  function initThumbnails(root) {
    var fallback = root.querySelector('[data-jk3d-fallback]');
    var image = root.querySelector('[data-jk3d-main-image]');

    root.querySelectorAll('[data-jk3d-thumb]').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        root.querySelectorAll('[data-jk3d-thumb]').forEach(function (item) {
          item.classList.toggle('is-active', item === thumb);
        });

        if (thumb.getAttribute('data-view') === 'model') {
          root.classList.remove('is-image-mode');
          return;
        }

        root.classList.add('is-image-mode');

        if (image && thumb.getAttribute('data-image-url')) {
          image.style.opacity = '0';
          window.setTimeout(function () {
            image.src = thumb.getAttribute('data-image-url');
            image.style.opacity = '1';
          }, 150);
        }

        if (!image && fallback) {
          fallback.classList.add('is-generated-preview');
        }
      });
    });
  }

  function initOptions(root) {
    var moneyFormat = root.getAttribute('data-money-format') || '';
    var basePrice = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    var links = root.querySelectorAll('[data-jk3d-link]');

    function update() {
      var metal = optionData(activeOption(root, 'metal'), { value: 'platinum', label: 'Platinum', adjustment: 0 });
      var shape = optionData(activeOption(root, 'shape'), { value: 'round', label: 'Round', adjustment: 0 });
      var setting = optionData(activeOption(root, 'setting'), { value: 'solitaire', label: 'Solitaire', adjustment: 0 });
      var sideDiamonds = setting.value === 'three-stone' ? 'Matched side stones' : setting.value === 'halo' || setting.value === 'hidden-halo' ? 'Accent melee diamonds' : 'None selected';
      var estimate = Math.max(0, basePrice + metal.adjustment + shape.adjustment + setting.adjustment);
      var formattedEstimate = formatMoney(estimate, moneyFormat);
      var payload = {
        metal: metal.label,
        metalHandle: metal.value,
        shape: shape.label,
        shapeHandle: shape.value,
        setting: setting.label,
        settingHandle: setting.value,
        sideDiamonds: sideDiamonds,
        estimatedPrice: formattedEstimate,
        estimatedPriceCents: estimate
      };

      root.setAttribute('data-metal', metal.value);
      root.setAttribute('data-shape', shape.value);
      root.setAttribute('data-setting', setting.value);

      setText(root, '[data-jk3d-summary]', shape.label + ' ' + setting.label.toLowerCase() + ' in ' + metal.label);
      setText(root, '[data-jk3d-detail="metal"]', metal.label);
      setText(root, '[data-jk3d-detail="side-diamonds"]', sideDiamonds);
      setText(root, '[data-jk3d-price]', formattedEstimate);
      links.forEach(function (link) { updateLink(link, payload); });

      window.Joyari3DRingSelection = payload;
      root.dispatchEvent(new CustomEvent('joyari:3d-ring:update', {
        bubbles: true,
        detail: payload
      }));
    }

    root.querySelectorAll('[data-jk3d-option]').forEach(function (option) {
      option.addEventListener('click', function () {
        var group = option.getAttribute('data-group');

        root.querySelectorAll('[data-jk3d-option][data-group="' + group + '"]').forEach(function (item) {
          item.classList.toggle('is-active', item === option);
        });

        update();
      });
    });

    update();
  }

  function initBuilder(root) {
    initModel(root);
    initThumbnails(root);
    initOptions(root);
  }

  function init() {
    document.querySelectorAll('[data-joyari-3d-ring-builder]').forEach(initBuilder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
