(function () {
  'use strict';

  var theme = window.JoyariTheme || {};

  function ensureCurrentThemeStylesheet() {
    var script = document.currentScript || document.querySelector('script[src*="/assets/theme.js"]');
    if (!script || !script.src || document.querySelector('link[data-joyari-current-theme-css]')) return;

    var stylesheetUrl = script.src.replace('/assets/theme.js', '/assets/theme.css');
    if (stylesheetUrl === script.src) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheetUrl;
    link.setAttribute('data-joyari-current-theme-css', 'true');
    document.head.appendChild(link);
  }

  ensureCurrentThemeStylesheet();

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

  function pauseInactiveProductVideos(root, activeMedia) {
    root.querySelectorAll('.jk-product-media video').forEach(function (video) {
      if (!activeMedia || !activeMedia.contains(video)) {
        video.pause();
      }
    });
  }

  function playActiveProductVideo(activeMedia) {
    if (!activeMedia) return;
    var video = activeMedia.querySelector('video');
    if (!video) return;

    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {});
    }
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
      var isActive = trigger === id || imageTrigger === id;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    pauseInactiveProductVideos(root, media);
    playActiveProductVideo(media);
  }

  function selectRelativeMedia(root, direction) {
    var items = Array.prototype.slice.call(root.querySelectorAll('[data-media-id]'));
    if (items.length < 2) return;

    var activeIndex = items.findIndex(function (item) {
      return item.classList.contains('is-active');
    });
    var nextIndex = activeIndex + direction;

    if (nextIndex < 0) nextIndex = items.length - 1;
    if (nextIndex >= items.length) nextIndex = 0;

    selectMedia(root, items[nextIndex].getAttribute('data-media-id'));
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

    root.querySelectorAll('[data-media-previous]').forEach(function (button) {
      button.addEventListener('click', function () {
        selectRelativeMedia(root, -1);
      });
    });

    root.querySelectorAll('[data-media-next]').forEach(function (button) {
      button.addEventListener('click', function () {
        selectRelativeMedia(root, 1);
      });
    });

    root.querySelectorAll('[data-product-gallery]').forEach(function (gallery) {
      var startX = null;
      var startY = null;

      gallery.addEventListener('touchstart', function (event) {
        if (!event.touches || event.touches.length !== 1) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }, { passive: true });

      gallery.addEventListener('touchend', function (event) {
        if (startX === null || startY === null || !event.changedTouches || event.changedTouches.length !== 1) return;

        var deltaX = event.changedTouches[0].clientX - startX;
        var deltaY = event.changedTouches[0].clientY - startY;
        startX = null;
        startY = null;

        if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;
        selectRelativeMedia(root, deltaX < 0 ? 1 : -1);
      }, { passive: true });
    });

    updateVariantState();
  }

  function initNavigation() {
    var header = document.querySelector('[data-header]');
    if (!header) return;

    var toggle = header.querySelector('[data-nav-toggle]');
    var drawerId = toggle ? toggle.getAttribute('aria-controls') : '';
    var drawer = drawerId ? document.getElementById(drawerId) : document.querySelector('[data-mobile-drawer]');
    var desktopDropdowns = header.querySelectorAll('[data-desktop-dropdown]');
    var dropdownLayer = document.querySelector('[data-desktop-dropdown-layer]');
    var desktopPanels = document.querySelectorAll('[data-desktop-dropdown-panel]');
    var desktopMedia = window.matchMedia('(min-width: 1361px)');
    var desktopCloseTimer;
    if (!toggle || !drawer) return;

    function setDropdownPosition() {
      var rect = header.getBoundingClientRect();
      var top = Math.ceil(Math.max(0, rect.bottom)) + 'px';
      document.documentElement.style.setProperty('--jk-dropdown-top', top);
      document.documentElement.style.setProperty('--jk-mega-top', top);

      if (dropdownLayer) {
        if (dropdownLayer.parentNode !== document.body) {
          document.body.appendChild(dropdownLayer);
        }

        dropdownLayer.style.position = 'fixed';
        dropdownLayer.style.inset = '0';
        dropdownLayer.style.zIndex = '2147483001';
        dropdownLayer.style.overflow = 'visible';
        dropdownLayer.style.pointerEvents = 'none';
      }

      var headerSection = header.closest('[id^="shopify-section-"], .shopify-section');
      if (headerSection) {
        headerSection.style.position = 'relative';
        headerSection.style.zIndex = '2147483000';
        headerSection.style.overflow = 'visible';
        headerSection.style.transform = 'none';
        headerSection.style.animation = 'none';
        headerSection.style.contain = 'none';
      }
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

      desktopPanels.forEach(function (panel) {
        if (exceptItem && panel.id === exceptItem.getAttribute('data-desktop-dropdown-target')) return;
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        panel.style.opacity = '';
        panel.style.visibility = '';
        panel.style.pointerEvents = '';
        panel.style.transform = '';
      });

      if (!exceptItem && dropdownLayer) {
        dropdownLayer.classList.remove('is-open');
        dropdownLayer.style.pointerEvents = 'none';
      }
    }

    function scheduleDesktopClose() {
      cancelDesktopClose();
      desktopCloseTimer = window.setTimeout(function () {
        if (
          document.querySelector('[data-desktop-dropdown]:hover') ||
          document.querySelector('[data-desktop-dropdown-panel].is-open:hover')
        ) {
          return;
        }

        closeDesktopDropdowns();
      }, 520);
    }

    function openDesktopDropdown(item) {
      if (!item || !desktopMedia.matches) return;
      cancelDesktopClose();
      setDropdownPosition();
      closeDesktopDropdowns(item);
      item.classList.add('is-open');

      var button = item.querySelector('[data-desktop-dropdown-toggle]');
      if (button) button.setAttribute('aria-expanded', 'true');

      var panelId = item.getAttribute('data-desktop-dropdown-target');
      var panel = panelId ? document.getElementById(panelId) : null;
      if (panel) {
        if (dropdownLayer) {
          dropdownLayer.classList.add('is-open');
          dropdownLayer.style.pointerEvents = 'none';
        }
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        panel.style.opacity = '1';
        panel.style.visibility = 'visible';
        panel.style.pointerEvents = 'auto';
        panel.style.transform = 'translateX(-50%) translateY(0)';
      }
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
      item.addEventListener('mouseenter', function () {
        openDesktopDropdown(item);
      });

      item.addEventListener('focusin', function () {
        openDesktopDropdown(item);
      });

      item.addEventListener('mouseleave', scheduleDesktopClose);
    });

    desktopPanels.forEach(function (panel) {
      panel.addEventListener('mouseenter', cancelDesktopClose);
      panel.addEventListener('mouseleave', scheduleDesktopClose);
      panel.addEventListener('focusin', cancelDesktopClose);
    });

    header.querySelectorAll('[data-desktop-dropdown-toggle]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var item = button.closest('[data-desktop-dropdown]');
        toggleDesktopDropdown(item);
      });
    });

    document.querySelectorAll('[data-desktop-dropdown-panel] a').forEach(function (link) {
      link.addEventListener('click', function () {
        window.setTimeout(closeDesktopDropdowns, 0);
      });
    });

    drawer.querySelectorAll('[data-mobile-submenu-toggle]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
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
        if (element.matches('[data-nav-link]')) {
          window.setTimeout(function () {
            setMenuOpen(false);
          }, 0);
          return;
        }

        setMenuOpen(false);
      });
    });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (!target.closest('[data-desktop-dropdown]') && !target.closest('[data-desktop-dropdown-panel]')) {
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
      if (document.querySelector('[data-desktop-dropdown-panel].is-open')) {
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

  function initCollectionFilters() {
    document.querySelectorAll('[data-collection-shop]').forEach(function (root) {
      var drawer = root.querySelector('[data-collection-filter-drawer]');
      var openButton = root.querySelector('[data-collection-filter-open]');
      var closeButtons = root.querySelectorAll('[data-collection-filter-close]');
      var form = root.querySelector('[data-collection-filter-form]');
      var sortSelect = root.querySelector('[data-collection-sort]');

      function lockFilterScroll(isLocked) {
        document.documentElement.classList.toggle('jk-filter-lock', isLocked);
        document.body.classList.toggle('jk-filter-lock', isLocked);
      }

      function setFilterOpen(isOpen) {
        root.classList.toggle('is-filter-open', isOpen);
        if (drawer) drawer.classList.toggle('is-open', isOpen);
        if (openButton) openButton.setAttribute('aria-expanded', String(isOpen));
        lockFilterScroll(isOpen && window.matchMedia('(max-width: 989px)').matches);
      }

      if (openButton && drawer) {
        openButton.addEventListener('click', function () {
          setFilterOpen(true);
        });
      }

      closeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          setFilterOpen(false);
        });
      });

      if (sortSelect && form) {
        sortSelect.addEventListener('change', function () {
          form.submit();
        });
      }

      if (form) {
        form.addEventListener('submit', function () {
          setFilterOpen(false);
        });
      }

      window.addEventListener('resize', function () {
        if (window.innerWidth >= 990) {
          lockFilterScroll(false);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initCollectionFilters();
    initRingSizeGuides();
    document.querySelectorAll('[data-product-builder]').forEach(initProductBuilder);
  });
})();
