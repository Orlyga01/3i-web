(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        const api = factory(require('./more_info_shared'));
        module.exports = api;
        return;
    }
    const api = factory(root.MoreInfoShared || {});
    root.MoreInfoModalShared = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (MoreInfoShared) {
    'use strict';

    const AppTranslations = (typeof globalThis !== 'undefined' ? globalThis.AppTranslations : null) || {};

    function getModalLocale() {
        return AppTranslations.getLocaleFromSearch?.(
            typeof location !== 'undefined' ? location.search : ''
        ) || 'en';
    }

    function mt(name, fallback = '', params = null) {
        const sourceText = fallback || (typeof name === 'string' ? name : '');
        return AppTranslations.translate?.(sourceText, {
            locale: getModalLocale(),
            params,
            fallback: sourceText,
        }) || sourceText;
    }

    function buildMoreInfoModalModel(point, designation, options = {}) {
        const normalizeMoreInfo = MoreInfoShared.normalizeMoreInfo || (() => ({
            images: [],
            video: null,
            text: '',
            pageName: '',
            hasContent: false,
        }));
        const trimOptionalString = MoreInfoShared.trimOptionalString || (value => typeof value === 'string' ? value.trim() : '');
        const translatedPoint = AppTranslations.translatePoint?.(designation, point, getModalLocale()) || point;
        const info = normalizeMoreInfo(translatedPoint?.more_info, designation);

        return {
            title: trimOptionalString(options.title) || mt('ui.trajectoryPlayer.pointMoreInfoTitle', 'Point More Info'),
            dateText: trimOptionalString(options.dateText) || trimOptionalString(translatedPoint?.date) || '--',
            description: trimOptionalString(options.description ?? translatedPoint?.description),
            designation: trimOptionalString(designation),
            point: translatedPoint || null,
            info,
            hasContent: Boolean(info.hasContent),
        };
    }

    class MoreInfoImageZoomController {
        constructor(root) {
            this.root = root;
            this.imageEl = root?.querySelector('.mi-zoom-image') || null;
            this.captionEl = root?.querySelector('.mi-zoom-caption') || null;
            this.closeBtn = root?.querySelector('.mi-zoom-close') || null;
            this.scale = 1;
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.handleWheel = this.handleWheel.bind(this);

            this.closeBtn?.addEventListener('click', () => this.hide());
            this.root?.addEventListener('click', event => {
                if (event.target === this.root) this.hide();
            });
            this.root?.addEventListener('wheel', this.handleWheel, { passive: false });
        }

        handleKeyDown(event) {
            if (event.key === 'Escape') this.hide();
        }

        handleWheel(event) {
            if (!this.root?.classList.contains('visible') || !this.imageEl) return;
            event.preventDefault();

            const direction = event.deltaY < 0 ? 1 : -1;
            const nextScale = this.scale + direction * 0.12;
            this.scale = Math.max(0.5, Math.min(6, nextScale));
            this.applyScale();
        }

        applyScale() {
            if (!this.imageEl) return;
            this.imageEl.style.transform = `scale(${this.scale})`;
        }

        show(image) {
            if (!this.root || !this.imageEl) return;
            this.scale = 1;
            this.imageEl.src = image?.url || '';
            this.imageEl.alt = image?.caption || mt('ui.moreInfoModal.zoomedImageAlt', 'Zoomed image');
            this.applyScale();
            if (this.captionEl) {
                this.captionEl.textContent = image?.caption || '';
                this.captionEl.style.display = image?.caption ? 'block' : 'none';
            }
            this.root.classList.add('visible');
            document.addEventListener('keydown', this.handleKeyDown);
        }

        hide() {
            if (!this.root || !this.imageEl) return;
            this.root.classList.remove('visible');
            this.scale = 1;
            this.applyScale();
            this.imageEl.removeAttribute('src');
            if (this.captionEl) this.captionEl.textContent = '';
            document.removeEventListener('keydown', this.handleKeyDown);
        }
    }

    class MoreInfoModalController {
        constructor(root, options = {}) {
            this.root = root;
            this.options = options;
            this.handleKeyDown = this.handleKeyDown.bind(this);
            if (!this.root) return;

            this.root.classList.add('mi-root');
            this.root.innerHTML = `
                <div class="mi-dialog" role="document">
                    <div class="mi-header">
                        <div class="mi-header-copy">
                            <div class="mi-kicker"></div>
                            <div class="mi-meta-row">
                                <div class="mi-date">--</div>
                                <div class="mi-description"></div>
                            </div>
                        </div>
                        <div class="mi-header-actions">
                            <button class="mi-expand-btn" type="button" aria-label="Expand more info modal">Expand</button>
                            <button class="mi-close-btn" type="button" aria-label="Close more info modal">×</button>
                        </div>
                    </div>
                    <div class="mi-body"></div>
                </div>
                <div class="mi-zoom-root" aria-hidden="true">
                    <div class="mi-zoom-dialog">
                        <button class="mi-zoom-close" type="button" aria-label="Close zoomed image">×</button>
                        <img class="mi-zoom-image" alt="">
                        <div class="mi-zoom-caption"></div>
                    </div>
                </div>
            `;

            this.dialogEl = this.root.querySelector('.mi-dialog');
            this.kickerEl = this.root.querySelector('.mi-kicker');
            this.dateEl = this.root.querySelector('.mi-date');
            this.descriptionEl = this.root.querySelector('.mi-description');
            this.bodyEl = this.root.querySelector('.mi-body');
            this.expandBtn = this.root.querySelector('.mi-expand-btn');
            this.closeBtn = this.root.querySelector('.mi-close-btn');
            this.zoomController = new MoreInfoImageZoomController(this.root.querySelector('.mi-zoom-root'));

            this.kickerEl.textContent = this.options.title || mt('ui.trajectoryPlayer.pointMoreInfoTitle', 'Point More Info');

            this.closeBtn?.addEventListener('click', () => this.hide());
            this.expandBtn?.addEventListener('click', () => this.toggleExpanded());
            this.root.addEventListener('click', event => {
                if (event.target === this.root) this.hide();
            });
        }

        isVisible() {
            return Boolean(this.root?.classList.contains('visible'));
        }

        handleKeyDown(event) {
            if (event.key === 'Escape' && this.zoomController?.root?.classList.contains('visible')) {
                this.zoomController.hide();
                return;
            }
            if (event.key === 'Escape') this.hide();
        }

        setExpanded(expanded) {
            if (!this.root || !this.expandBtn) return;
            this.root.classList.toggle('is-expanded', Boolean(expanded));
            this.expandBtn.textContent = expanded ? 'Collapse' : 'Expand';
            this.expandBtn.setAttribute('aria-label', expanded ? 'Collapse more info modal' : 'Expand more info modal');
        }

        toggleExpanded() {
            this.setExpanded(!this.root.classList.contains('is-expanded'));
        }

        buildSection(title) {
            const section = document.createElement('section');
            section.className = 'mi-section';
            const heading = document.createElement('div');
            heading.className = 'mi-section-title';
            heading.textContent = title;
            section.appendChild(heading);
            return section;
        }

        appendImages(section, images) {
            const gallery = document.createElement('div');
            gallery.className = 'mi-gallery';

            images.forEach(image => {
                const card = document.createElement('figure');
                card.className = 'mi-image-card';

                const img = document.createElement('img');
                img.className = 'mi-image';
                img.src = image.url;
                img.alt = image.caption || mt('ui.moreInfoModal.moreInfoImageAlt', 'More info image');
                img.addEventListener('click', () => this.zoomController.show(image));
                card.appendChild(img);

                const actions = document.createElement('div');
                actions.className = 'mi-image-actions';

                const zoomBtn = document.createElement('button');
                zoomBtn.className = 'mi-image-zoom-btn';
                zoomBtn.type = 'button';
                zoomBtn.textContent = 'Zoom';
                zoomBtn.addEventListener('click', () => this.zoomController.show(image));
                actions.appendChild(zoomBtn);

                const openBtn = document.createElement('a');
                openBtn.className = 'mi-image-open-link';
                openBtn.href = image.url;
                openBtn.target = '_blank';
                openBtn.rel = 'noreferrer noopener';
                openBtn.textContent = 'Open original';
                actions.appendChild(openBtn);

                card.appendChild(actions);

                if (image.caption) {
                    const caption = document.createElement('figcaption');
                    caption.className = 'mi-image-caption';
                    caption.textContent = image.caption;
                    card.appendChild(caption);
                }

                gallery.appendChild(card);
            });

            section.appendChild(gallery);
        }

        appendVideo(section, videoEntry, designation) {
            const model = typeof MoreInfoShared.buildMoreInfoVideoModel === 'function'
                ? MoreInfoShared.buildMoreInfoVideoModel(videoEntry, designation)
                : { type: 'none', src: '', title: '' };

            if (model.type === 'youtube-embed') {
                const frame = document.createElement('iframe');
                frame.className = 'mi-video-frame';
                frame.src = model.src;
                frame.title = model.title || mt('ui.moreInfoModal.embeddedVideoTitle', 'Embedded video');
                frame.loading = 'lazy';
                frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                frame.allowFullscreen = true;
                section.appendChild(frame);
                return true;
            }

            if (model.type === 'html5') {
                const video = document.createElement('video');
                video.className = 'mi-video';
                video.src = model.src;
                video.controls = true;
                video.preload = 'metadata';
                section.appendChild(video);
                return true;
            }

            if (model.type === 'link') {
                const link = document.createElement('a');
                link.className = 'mi-link';
                link.href = model.src;
                link.target = '_blank';
                link.rel = 'noreferrer noopener';
                link.textContent = model.title || mt('ui.moreInfoModal.openVideo', 'Open video');
                section.appendChild(link);
                return true;
            }

            return false;
        }

        show(context = {}) {
            if (!this.root || !this.bodyEl || !this.dateEl || !this.descriptionEl) return;
            const model = buildMoreInfoModalModel(context.point, context.designation, {
                title: context.title || this.options.title || mt('ui.trajectoryPlayer.pointMoreInfoTitle', 'Point More Info'),
                dateText: context.dateText,
                description: context.description,
            });
            if (!model.hasContent) return;

            this.kickerEl.textContent = model.title;
            this.dateEl.textContent = model.dateText;
            this.descriptionEl.textContent = model.description;
            this.descriptionEl.style.display = model.description ? 'block' : 'none';
            this.bodyEl.innerHTML = '';

            if (model.info.pageName) {
                const pageSection = this.buildSection(mt('ui.moreInfoModal.customPage', 'Custom Page'));
                const frame = document.createElement('iframe');
                frame.className = 'mi-page-frame';
                frame.src = AppTranslations.withLangParam?.(model.info.pageName, getModalLocale()) || model.info.pageName;
                frame.title = mt('ui.moreInfoModal.embeddedPageTitle', 'Embedded more info page');
                frame.loading = 'lazy';
                pageSection.appendChild(frame);
                this.bodyEl.appendChild(pageSection);
            }

            if (model.info.text) {
                const textSection = this.buildSection(mt('ui.moreInfoModal.additionalText', 'Additional Text'));
                const textEl = document.createElement('div');
                textEl.className = 'mi-text';
                textEl.textContent = model.info.text;
                textSection.appendChild(textEl);
                this.bodyEl.appendChild(textSection);
            }

            if (model.info.images.length) {
                const imageSection = this.buildSection(mt('ui.moreInfoModal.images', 'Images'));
                this.appendImages(imageSection, model.info.images);
                this.bodyEl.appendChild(imageSection);
            }

            if (model.info.video) {
                const videoSection = this.buildSection(mt('ui.moreInfoModal.video', 'Video'));
                if (this.appendVideo(videoSection, model.info.video, model.designation)) {
                    this.bodyEl.appendChild(videoSection);
                }
            }

            if (!this.bodyEl.childElementCount) {
                const empty = document.createElement('div');
                empty.className = 'mi-empty';
                empty.textContent = mt('ui.moreInfoModal.noContent', 'No additional information is available for this point yet.');
                this.bodyEl.appendChild(empty);
            }

            this.setExpanded(false);
            this.root.classList.add('visible');
            document.addEventListener('keydown', this.handleKeyDown);
        }

        hide() {
            if (!this.root) return;
            this.zoomController?.hide();
            this.root.classList.remove('visible');
            this.root.classList.remove('is-expanded');
            if (this.bodyEl) this.bodyEl.innerHTML = '';
            document.removeEventListener('keydown', this.handleKeyDown);
            this.setExpanded(false);
        }
    }

    function createModalController(root, options = {}) {
        return new MoreInfoModalController(root, options);
    }

    return {
        buildMoreInfoModalModel,
        createModalController,
        MoreInfoModalController,
    };
});
