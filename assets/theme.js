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

    if (isNaN(number) || number == null) {
      return '0';
    }

    var fixed = (number / 100).toFixed(precision);
    var parts = fixed.split('.');
    var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    var cents = parts[1] ? decimal + parts[1] : '';
    return dollars + cents;
  }

  function formatMoney(cents) {
    if (!theme.moneyFormat) {
      return '$' + formatWithDelimiters(cents, 2);
    }

    var format = theme.moneyFormat;
    var value = typeof cents === 'string' ? cents.replace('.', '') : cents;
    var placeholder = format.match(/\{\{\s*(\w+)\s*\}\}/);
    var amount = '';

    switch (placeholder && placeholder[1]) {
      case 'amount_no_decimals':
        amount = formatWithDelimiters(value, 0);
        break;
      case 'amount_with_comma_separator':
        amount = formatWithDelimiters(value, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        amount = formatWithDelimiters(value, 0, '.', ',');
        break;
      default:
        amount = formatWithDelimiters(value, 2);
        break;
    }

    return stripTags(format.replace(/\{\{\s*\w+\s*\}\}/, amount));
  }

  function escapeAttributeValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function getSelectedRadioValue(root, name) {
    var checked = root.querySelector('input[type="radio"][name="' + escapeAttributeValue(name) + '"]:checked');
    return checked ? checked.value : '';
  }

  function setText(root, selector, value) {
    root.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  function selectMedia(root, mediaId) {
    if (!mediaId) return;
    var id = String(mediaId);
    var escapedId = escapeAttributeValue(id);
    var media = root.querySelector('[data-media-id="' + escapedId + '"], [data-image-id="' + escapedId + '"]');
    if (!media) return;

    root.querySelectorAll('[data-media-id]').forEach(function (item) {
      item.classList.toggle('is-active', item === media);
    });
    root.querySelectorAll('[data-media-trigger]').forEach(function (button) {
      var trigger = button.getAttribute('data-media-trigger');
      var imageTrigger = button.getAttribute('data-image-trigger');
      button.classList.toggle('is-active', trigger === id || imageTrigger === id);
    });
  }

  function calculateBuilderAdjustment(root) {
    var adjustment = 0;

    root.querySelectorAll('[data-builder-choice]').forEach(function (input) {
      if (input.type === 'radio' && !input.checked) return;
      if (input.type === 'checkbox' && !input.checked) return;

      if (input.hasAttribute('data-price-adjustment')) {
        adjustment += parseInt(input.getAttribute('data-price-adjustment'), 10) || 0;
      }
    });

    var caratInput = root.querySelector('[data-carat-input]');
    if (caratInput) {
      var carat = parseFloat(caratInput.value) || 1;
      var baseCarat = parseFloat(root.getAttribute('data-base-carat')) || 1;
      var quarterPremium = parseInt(root.getAttribute('data-quarter-premium'), 10) || 0;
      var quarters = Math.max(0, Math.round((carat - baseCarat) / 0.25));
      adjustment += quarters * quarterPremium;
      setText(root, '[data-carat-output]', carat.toFixed(2) + ' ct');
    }

    return adjustment;
  }

  function updateStonePreview(root) {
    var selectedShape = root.querySelector('[data-shape-choice]:checked');
    var shape = selectedShape ? selectedShape.getAttribute('data-shape-choice') : '';
    if (!shape) return;

    root.querySelectorAll('[data-stone-preview]').forEach(function (preview) {
      preview.setAttribute('data-shape', shape);
    });
  }

  function initProductBuilder(root) {
    var jsonScript = root.querySelector('[data-product-json]');
    if (!jsonScript) return;

    var product;
    try {
      product = JSON.parse(jsonScript.textContent);
    } catch (error) {
      console.warn('Joyari product JSON could not be parsed.', error);
      return;
    }

    var variants = product.variants || [];
    var currentVariant = variants.find(function (variant) {
      return variant.available;
    }) || variants[0];

    function getSelectedOptions() {
      var optionFieldsets = Array.prototype.slice.call(root.querySelectorAll('[data-option-name][data-option-position]'));
      if (!optionFieldsets.length && currentVariant) {
        return currentVariant.options || [];
      }

      optionFieldsets.sort(function (a, b) {
        return parseInt(a.getAttribute('data-option-position'), 10) - parseInt(b.getAttribute('data-option-position'), 10);
      });

      return optionFieldsets.map(function (fieldset) {
        var checked = fieldset.querySelector('[data-option-input]:checked');
        return checked ? checked.value : '';
      });
    }

    function findVariant() {
      var selectedOptions = getSelectedOptions();
      return variants.find(function (variant) {
        return selectedOptions.every(function (option, index) {
          return variant.options[index] === option;
        });
      });
    }

    function updateEstimate(variant) {
      var basePrice = variant ? variant.price : 0;
      var adjustment = calculateBuilderAdjustment(root);
      var estimate = Math.max(0, basePrice + adjustment);
      var formattedEstimate = formatMoney(estimate);

      setText(root, '[data-builder-adjustment]', formatMoney(adjustment));
      setText(root, '[data-estimate-total]', formattedEstimate);

      root.querySelectorAll('[data-builder-estimate-property]').forEach(function (input) {
        input.value = formattedEstimate;
      });
    }

    function updateVariantState() {
      var variant = findVariant();
      currentVariant = variant || currentVariant;
      var available = Boolean(variant && variant.available);

      root.querySelectorAll('[data-variant-id-input]').forEach(function (input) {
        input.value = variant ? variant.id : '';
      });

      if (variant) {
        setText(root, '[data-variant-price]', formatMoney(variant.price));
        setText(root, '[data-variant-sku]', variant.sku || 'Made to order');

        var compareElements = root.querySelectorAll('[data-variant-compare]');
        compareElements.forEach(function (element) {
          if (variant.compare_at_price && variant.compare_at_price > variant.price) {
            element.textContent = formatMoney(variant.compare_at_price);
            element.classList.remove('is-hidden');
          } else {
            element.textContent = '';
            element.classList.add('is-hidden');
          }
        });

        var featuredMedia = variant.featured_media || variant.featured_image || null;
        if (featuredMedia && featuredMedia.id) {
          selectMedia(root, featuredMedia.id);
        }

        if (window.history && window.history.replaceState) {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          window.history.replaceState({ path: url.toString() }, '', url.toString());
        }
      }

      root.querySelectorAll('[data-add-to-cart]').forEach(function (button) {
        button.disabled = !available;
        button.textContent = available
          ? (window.themeProductAddText || 'Add to cart')
          : (variant ? 'Sold out' : 'Unavailable');
      });

      setText(root, '[data-availability]', available ? 'Available for secure checkout' : (variant ? 'This configuration is sold out' : 'This configuration is unavailable'));
      updateStonePreview(root);
      updateEstimate(variant);
    }

    root.querySelectorAll('[data-option-input], [data-builder-choice]').forEach(function (input) {
      input.addEventListener('change', updateVariantState);
      input.addEventListener('input', updateVariantState);
    });

    root.querySelectorAll('[data-media-trigger]').forEach(function (button) {
      button.addEventListener('click', function () {
        selectMedia(root, button.getAttribute('data-media-trigger'));
      });
    });

    updateVariantState();
  }

  function initBuilderShowcase(root) {
    function updateShowcase() {
      var basePrice = parseInt(root.getAttribute('data-base-price'), 10) || 0;
      var estimate = Math.max(0, basePrice + calculateBuilderAdjustment(root));
      var shape = root.querySelector('[data-shape-choice]:checked');
      var shapeValue = shape ? shape.value : 'Oval';
      var metal = getSelectedRadioValue(root, 'showcase-metal-' + root.id.replace('joyari-ring-builder', '').replace(/[^A-Za-z0-9_-]/g, ''));
      var diamond = getSelectedRadioValue(root, 'showcase-diamond-' + root.id.replace('joyari-ring-builder', '').replace(/[^A-Za-z0-9_-]/g, ''));

      if (!metal) {
        var metalInput = root.querySelector('input[name^="showcase-metal-"]:checked');
        metal = metalInput ? metalInput.value : '18k yellow gold';
      }
      if (!diamond) {
        var diamondInput = root.querySelector('input[name^="showcase-diamond-"]:checked');
        diamond = diamondInput ? diamondInput.value : 'lab-grown diamond';
      }

      updateStonePreview(root);
      setText(root, '[data-estimate-total]', formatMoney(estimate));
      setText(root, '[data-showcase-summary]', shapeValue + ' ' + diamond + ' in ' + metal);
    }

    root.querySelectorAll('[data-builder-choice]').forEach(function (input) {
      input.addEventListener('change', updateShowcase);
      input.addEventListener('input', updateShowcase);
    });

    updateShowcase();
  }

  function initNavigation() {
    var header = document.querySelector('[data-header]');
    if (!header) return;

    var toggle = header.querySelector('[data-nav-toggle]');
    var drawer = header.querySelector('[data-mobile-drawer]');
    var desktopDropdowns = header.querySelectorAll('[data-desktop-dropdown]');
    var desktopMedia = window.matchMedia('(min-width: 1361px)');
    var desktopCloseTimer;
    if (!toggle || !drawer) return;

    function setDropdownPosition() {
      var rect = header.getBoundingClientRect();
      header.style.setProperty('--jk-header-dropdown-top', Math.max(0, rect.bottom) + 'px');
    }

    function cancelDesktopClose() {
      window.clearTimeout(desktopCloseTimer);
    }

    function closeDesktopDropdowns(exceptItem) {
      cancelDesktopClose();

      desktopDropdowns.forEach(function (item) {
        if (exceptItem && item === exceptItem) return;
        if (!item.classList.contains('is-open')) return;

        item.classList.remove('is-open');
        var button = item.querySelector('[data-desktop-dropdown-toggle]');
        if (button) button.setAttribute('aria-expanded', 'false');
      });
    }

    function scheduleDesktopClose() {
      cancelDesktopClose();
      desktopCloseTimer = window.setTimeout(function () {
        closeDesktopDropdowns();
      }, 180);
    }

    function openDesktopDropdown(item) {
      if (!item || !desktopMedia.matches) return;
      cancelDesktopClose();
      setDropdownPosition();
      closeDesktopDropdowns(item);
      item.classList.add('is-open');

      var button = item.querySelector('[data-desktop-dropdown-toggle]');
      if (button) button.setAttribute('aria-expanded', 'true');
    }

    function toggleDesktopDropdown(item) {
      if (!item) return;

      if (item.classList.contains('is-open')) {
        closeDesktopDropdowns();
      } else {
        openDesktopDropdown(item);
      }
    }

    function closeMobileSubmenus(exceptGroup) {
      drawer.querySelectorAll('.jk-mobile-menu-group.is-open').forEach(function (group) {
        if (exceptGroup && group === exceptGroup) return;

        group.classList.remove('is-open');
        var button = group.querySelector('[data-mobile-submenu-toggle]');
        var panel = group.querySelector('[data-mobile-submenu]');
        if (button) button.setAttribute('aria-expanded', 'false');
        if (panel) panel.hidden = true;
      });
    }

    function lockScroll(isLocked) {
      document.documentElement.classList.toggle('jk-menu-lock', isLocked);
      document.body.classList.toggle('jk-menu-lock', isLocked);
    }

    function setMenuOpen(isOpen) {
      window.clearTimeout(drawer._joyariHideTimer);

      if (isOpen) {
        drawer.hidden = false;
        window.requestAnimationFrame(function () {
          drawer.classList.add('is-open');
          if (header) header.classList.add('is-menu-open');
          toggle.setAttribute('aria-expanded', 'true');
          lockScroll(true);

          var closeButton = drawer.querySelector('[data-nav-close]:not(.jk-mobile-drawer__backdrop)');
          if (closeButton) closeButton.focus();
        });
        return;
      }

      drawer.classList.remove('is-open');
      if (header) header.classList.remove('is-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      lockScroll(false);
      closeMobileSubmenus();

      drawer._joyariHideTimer = window.setTimeout(function () {
        if (!drawer.classList.contains('is-open')) {
          drawer.hidden = true;
        }
      }, 320);
    }

    toggle.addEventListener('click', function () {
      setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    desktopDropdowns.forEach(function (item) {
      var menu = item.querySelector('[data-desktop-dropdown-menu]');

      item.addEventListener('mouseenter', function () {
        openDesktopDropdown(item);
      });

      item.addEventListener('focusin', function () {
        openDesktopDropdown(item);
      });

      item.addEventListener('mouseleave', scheduleDesktopClose);

      if (menu) {
        menu.addEventListener('mouseenter', cancelDesktopClose);
        menu.addEventListener('mouseleave', scheduleDesktopClose);
      }
    });

    header.querySelectorAll('[data-desktop-dropdown-toggle]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var item = button.closest('[data-desktop-dropdown]');
        toggleDesktopDropdown(item);
      });
    });

    header.querySelectorAll('[data-desktop-dropdown-menu] a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeDesktopDropdowns();
      });
    });

    drawer.querySelectorAll('[data-mobile-submenu-toggle]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var group = button.closest('.jk-mobile-menu-group');
        var panelId = button.getAttribute('aria-controls');
        var panel = panelId ? document.getElementById(panelId) : null;
        if (!group || !panel) return;

        var shouldOpen = button.getAttribute('aria-expanded') !== 'true';
        closeMobileSubmenus(group);
        group.classList.toggle('is-open', shouldOpen);
        button.setAttribute('aria-expanded', String(shouldOpen));
        panel.hidden = !shouldOpen;
      });
    });

    drawer.querySelectorAll('[data-nav-close], [data-nav-link]').forEach(function (element) {
      element.addEventListener('click', function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!target.closest('[data-header] [data-desktop-dropdown]')) {
        closeDesktopDropdowns();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;

      closeDesktopDropdowns();
      if (drawer.classList.contains('is-open')) {
        setMenuOpen(false);
        if (toggle) toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      setDropdownPosition();
      closeDesktopDropdowns();
      if (window.innerWidth > 1360 && drawer.classList.contains('is-open')) {
        setMenuOpen(false);
      }
    });

    window.addEventListener('scroll', function () {
      if (header.querySelector('[data-desktop-dropdown].is-open')) {
        setDropdownPosition();
      }
    }, { passive: true });

    setDropdownPosition();
  }

  function closeRingSizeGuide(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');

    if (modal._joyariReturnFocus && typeof modal._joyariReturnFocus.focus === 'function') {
      modal._joyariReturnFocus.focus();
    }
  }

  function openRingSizeGuide(button) {
    var modalId = button.getAttribute('data-ring-size-guide-open');
    var modal = modalId ? document.getElementById(modalId) : null;
    if (!modal) return;

    modal._joyariReturnFocus = button;
    modal.removeAttribute('hidden');
    window.requestAnimationFrame(function () {
      modal.classList.add('is-open');
      var closeButton = modal.querySelector('[data-ring-size-guide-close]:not(.jk-size-guide-modal__backdrop)');
      if (closeButton) closeButton.focus();
    });
  }

  function initRingSizeGuides() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      var openButton = target.closest('[data-ring-size-guide-open]');
      if (openButton) {
        openRingSizeGuide(openButton);
        return;
      }

      var closeButton = target.closest('[data-ring-size-guide-close]');
      if (closeButton) {
        closeRingSizeGuide(closeButton.closest('[data-ring-size-guide-modal]'));
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var openModal = document.querySelector('[data-ring-size-guide-modal].is-open');
      if (openModal) closeRingSizeGuide(openModal);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initRingSizeGuides();
    document.querySelectorAll('[data-product-builder]').forEach(initProductBuilder);
    document.querySelectorAll('[data-builder-showcase]').forEach(initBuilderShowcase);
  });
})();
