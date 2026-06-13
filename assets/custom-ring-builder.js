(function () {
  'use strict';

  function formatMoney(cents, format) {
    var value = Number(cents) || 0;
    var moneyFormat = format || '${{amount}}';
    var match = moneyFormat.match(/\{\{\s*(\w+)\s*\}\}/);
    var precision = match && match[1] === 'amount_no_decimals' ? 0 : 2;
    var amount = (value / 100).toFixed(precision);
    var parts = amount.split('.');
    parts[0] = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    return moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, parts.join('.')).replace(/<[^>]*>/g, '');
  }

  function updateProperty(root, name, value) {
    root.querySelectorAll('[data-property-input="' + name + '"]').forEach(function (input) {
      input.value = value || '';
    });
  }

  function updatePrice(root) {
    var total = parseInt(root.getAttribute('data-base-price'), 10) || 0;
    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      total += parseInt(button.getAttribute('data-price'), 10) || 0;
    });
    total = Math.max(0, total);
    var formatted = formatMoney(total, root.getAttribute('data-money-format'));
    root.querySelectorAll('[data-estimate-price]').forEach(function (element) {
      element.textContent = formatted;
    });
    updateProperty(root, 'Configured Price', formatted);
  }

  function selectOption(root, button) {
    var group = button.getAttribute('data-group');
    var value = button.getAttribute('data-value');
    if (!group || !value) return;

    root.querySelectorAll('[data-option-button][data-group="' + group + '"]').forEach(function (candidate) {
      var selected = candidate === button;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    root.querySelectorAll('[data-selected-label="' + group + '"]').forEach(function (label) {
      label.textContent = value;
    });
    updateProperty(root, group, value);
    updatePrice(root);
  }

  function shareBuilder() {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).catch(function () {});
  }

  function initBuilder(root) {
    root.querySelectorAll('[data-option-button]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
      button.addEventListener('click', function () {
        selectOption(root, button);
      });
    });

    root.querySelectorAll('[data-option-button].is-selected').forEach(function (button) {
      var group = button.getAttribute('data-group');
      var value = button.getAttribute('data-value');
      updateProperty(root, group, value);
    });

    var share = root.querySelector('[data-builder-share]');
    if (share) share.addEventListener('click', shareBuilder);
    updatePrice(root);
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
