(function () {
  'use strict';

  function polishBrandText() {
    document.title = document.title
      .replace(/JoyariKrafted/g, 'Joyari Krafted')
      .replace(/Joyari krafted/g, 'Joyari Krafted');

    var metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) return;

    metaDescription.content = metaDescription.content
      .replace(/JoyariKrafted/g, 'Joyari Krafted')
      .replace(/Joyari krafted/g, 'Joyari Krafted');
  }

  function polishLegacyHeroImage() {
    var legacyHeroImage = 'ChatGPT_Image_May_25_2026_11_51_33_AM';
    var refinedHeroImage = 'https://joyarikrafted.com/cdn/shop/files/02_engagement_rings.png?v=1779674447';
    var widths = [900, 1200, 1600, 2000, 2400];

    document.querySelectorAll('.jk-hero__image').forEach(function (image) {
      var currentSource = [image.currentSrc, image.src, image.srcset].join(' ');
      if (currentSource.indexOf(legacyHeroImage) === -1) return;

      image.src = refinedHeroImage + '&width=2400';
      image.srcset = widths.map(function (width) {
        return refinedHeroImage + '&width=' + width + ' ' + width + 'w';
      }).join(', ');
      image.sizes = '100vw';
      image.alt = 'Joyari Krafted engagement ring editorial image';
      image.classList.add('is-luxury-polished');
    });
  }

  function createTextElement(tagName, className, text) {
    var element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function polishFallbackProductCards() {
    var pathways = [
      {
        title: 'Engagement Rings',
        badge: 'Bridal Icons',
        summary: 'Explore refined centre-stone rings made for the proposal moment.',
        href: '/collections/engagement-rings'
      },
      {
        title: 'Wedding Bands',
        badge: 'Forever Pieces',
        summary: 'Discover elegant bands designed to stack, contour, or shine alone.',
        href: '/collections/wedding-bands'
      },
      {
        title: 'Diamond Jewellery',
        badge: 'Fine Jewellery',
        summary: 'Shop luminous diamond pieces for meaningful everyday wear.',
        href: '/collections/diamond-jewellery'
      },
      {
        title: 'Custom Design',
        badge: 'Private Design',
        summary: 'Begin a made-to-order ring with personal guidance from Joyari.',
        href: '/pages/custom-design'
      }
    ];

    document.querySelectorAll('.jk-product-card--placeholder').forEach(function (card, index) {
      var pathway = pathways[index % pathways.length];
      if (!pathway) return;

      card.classList.remove('jk-product-card--placeholder');
      card.classList.add('jk-product-card--pathway');

      var media = card.querySelector('.jk-product-card__media');
      if (media && media.tagName !== 'A') {
        var linkedMedia = document.createElement('a');
        linkedMedia.className = media.className;
        linkedMedia.href = pathway.href;
        while (media.firstChild) linkedMedia.appendChild(media.firstChild);
        media.replaceWith(linkedMedia);
        media = linkedMedia;
      } else if (media) {
        media.href = pathway.href;
      }

      var quick = card.querySelector('.jk-product-card__quick');
      if (quick) quick.textContent = 'View collection';

      var content = card.querySelector('.jk-product-card__content');
      if (!content) return;

      var existingHeading = content.querySelector('.jk-product-card__title');
      var headingTag = existingHeading ? existingHeading.tagName.toLowerCase() : 'h3';
      var title = document.createElement(headingTag);
      title.className = 'jk-product-card__title';

      var titleLink = document.createElement('a');
      titleLink.href = pathway.href;
      titleLink.textContent = pathway.title;
      title.appendChild(titleLink);

      var action = document.createElement('a');
      action.className = 'jk-product-card__action';
      action.href = pathway.href;
      action.textContent = 'Explore';

      content.replaceChildren(
        createTextElement('p', 'jk-product-card__meta', pathway.badge),
        title,
        createTextElement('p', 'jk-product-card__summary', pathway.summary),
        action
      );
    });
  }

  function reinforceOverlayStacking() {
    if (document.getElementById('joyari-overlay-polish')) return;

    var style = document.createElement('style');
    style.id = 'joyari-overlay-polish';
    style.textContent = [
      '@media (max-width: 989px) {',
      '  .jk-collection-filter-backdrop { z-index: 2147483400 !important; }',
      '  .jk-collection-filters { z-index: 2147483401 !important; }',
      '  .shopify-section--luxury-product-grid { animation: none !important; transform: none !important; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function init() {
    reinforceOverlayStacking();
    polishBrandText();
    polishLegacyHeroImage();
    polishFallbackProductCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
