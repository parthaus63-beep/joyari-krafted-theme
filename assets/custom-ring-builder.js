(function () {
  'use strict';

  function formatWithDelimiters(number, precision) {
    var fixed = (number / 100).toFixed(precision == null ? 2 : precision);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    return parts.join('.');
  }

  function formatMoney(cents, format) {
    var value = Number(cents) || 0;
    var moneyFormat = format || (window.JoyariTheme && window.JoyariTheme.moneyFormat) || '${{amount}}';
    var match = moneyFormat.match(/\{\{\s*(\w+)\s*\}\}/);
    var amount = formatWithDelimiters(value, match && match[1] === 'amount_no_decimals' ? 0 : 2);
    return moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, amount).replace(/<[^>]*>/g, '');
  }

  function updateProperty(root, name, value) {
    root.querySelectorAll('[data-property-input="' + name + '"]').forEach(function (input) {
      input.value = value || '';
    });
  }

  function updateSummary(root, name, value) {
    root.querySelectorAll('[data-summary="' + name + '"]').forEach(function (element) {
      element.textContent = value || 'None';
    });
    updateProperty(root, name, value);
  }

  function updateEstimate(root) {
    var base = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    var adjustment = 0;

    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      adjustment += parseInt(button.getAttribute('data-price'), 10) || 0;
    });

    root.querySelectorAll('[data-select-option]').forEach(function (select) {
      var selected = select.options[select.selectedIndex];
      adjustment += parseInt(selected && selected.getAttribute('data-price'), 10) || 0;
    });

    var total = Math.max(0, base + adjustment);
    var formatted = formatMoney(total, root.getAttribute('data-money-format'));

    root.querySelectorAll('[data-estimate-price]').forEach(function (element) {
      element.textContent = formatted;
    });

    updateProperty(root, 'Estimated Total', formatted);
  }

  function updatePreview(root, button) {
    var image = button.getAttribute('data-image');
    var handle = button.getAttribute('data-handle') || '';
    var group = button.getAttribute('data-group');
    var value = button.getAttribute('data-value');
    var previewImage = root.querySelector('[data-preview-image]');
    var tone = root.querySelector('[data-preview-tone]');

    if (image && previewImage) {
      previewImage.classList.add('is-changing');
      window.setTimeout(function () {
        previewImage.src = image;
        previewImage.removeAttribute('srcset');
        previewImage.alt = value + ' preview';
        previewImage.classList.remove('is-changing');
      }, 120);
    }

    if (group === 'Metal' && tone) {
      tone.className = 'jkrb__preview-tone jkrb__preview-tone--' + handle;
      root.querySelectorAll('[data-preview-metal]').forEach(function (element) {
        element.textContent = value;
      });
    }

    if (group === 'Setting') {
      root.querySelectorAll('[data-preview-setting]').forEach(function (element) {
        element.textContent = value;
      });
    }
  }

  function selectButton(root, button) {
    var group = button.getAttribute('data-group');
    if (!group) return;

    root.querySelectorAll('[data-option-button][data-group="' + group + '"]').forEach(function (candidate) {
      candidate.classList.toggle('is-selected', candidate === button);
      candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false');
    });

    updateSummary(root, group, button.getAttribute('data-value'));
    updatePreview(root, button);
    updateEstimate(root);
  }

  function selectDropdown(root, select) {
    var group = select.getAttribute('data-group');
    if (!group) return;
    updateSummary(root, group, select.value);
    updateEstimate(root);
  }

  function updateEngraving(root, input) {
    var value = input.value.trim();
    updateSummary(root, 'Engraving', value || 'None');
    updateProperty(root, 'Engraving', value);
  }

  function initBuilder(root) {
    root.querySelectorAll('[data-option-button]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
      button.addEventListener('click', function () {
        selectButton(root, button);
      });
    });

    root.querySelectorAll('[data-select-option]').forEach(function (select) {
      select.addEventListener('change', function () {
        selectDropdown(root, select);
      });
      selectDropdown(root, select);
    });

    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      updateSummary(root, button.getAttribute('data-group'), button.getAttribute('data-value'));
      updatePreview(root, button);
    });

    var engraving = root.querySelector('[data-engraving-input]');
    if (engraving) {
      engraving.addEventListener('input', function () {
        updateEngraving(root, engraving);
      });
      updateEngraving(root, engraving);
    }

    updateEstimate(root);
  }

  function initAll() {
    document.querySelectorAll('[data-custom-ring-builder]').forEach(initBuilder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
