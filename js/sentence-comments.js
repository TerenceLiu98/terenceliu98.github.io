(() => {
  console.log('[sentence-comments] Script loaded');
  
  const article = document.querySelector('[itemprop="articleBody"]');
  console.log('[sentence-comments] Article element:', article);
  
  if (!article) {
    console.warn('[sentence-comments] No article element found with [itemprop="articleBody"]');
    return;
  }

  const commentsSection = document.getElementById('comments');
  console.log('[sentence-comments] Comments section:', commentsSection);
  
  const giscusTemplate = commentsSection
    ? commentsSection.querySelector('script[src*="giscus.app/client.js"]')
    : null;
  const utterancesTemplate = commentsSection
    ? commentsSection.querySelector('script[src*="utteranc.es/client.js"]')
    : null;

  const provider = giscusTemplate ? 'giscus' : utterancesTemplate ? 'utterances' : null;
  console.log('[sentence-comments] Provider detected:', provider);
  console.log('[sentence-comments] Giscus template:', giscusTemplate);
  console.log('[sentence-comments] Utterances template:', utterancesTemplate);

  if (!provider) {
    console.warn('[sentence-comments] No comments provider found (giscus or utterances)');
    return;
  }

  const state = {
    selectionText: '',
    range: null,
  };

  const selectionButton = document.createElement('button');
  selectionButton.type = 'button';
  selectionButton.className = 'sentence-comment-selection-button';
  selectionButton.textContent = '评论这句';
  selectionButton.hidden = true;

  const panel = document.createElement('section');
  panel.className = 'sentence-comment-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="sentence-comment-panel-header">
      <p class="sentence-comment-panel-title">对选中的句子发表评论</p>
      <button type="button" class="sentence-comment-panel-close">关闭</button>
    </div>
    <blockquote class="sentence-comment-quote"></blockquote>
    <div class="sentence-comment-thread"></div>
  `;

  const closeButton = panel.querySelector('.sentence-comment-panel-close');
  const quote = panel.querySelector('.sentence-comment-quote');
  const thread = panel.querySelector('.sentence-comment-thread');

  article.parentNode.insertBefore(panel, commentsSection || null);
  document.body.appendChild(selectionButton);

  function fnv1a(input) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeSelection(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function selectionIsInsideArticle(selection) {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false;
    }

    const range = selection.getRangeAt(0);
    return article.contains(range.commonAncestorContainer);
  }

  function hideSelectionButton() {
    selectionButton.hidden = true;
    state.range = null;
    state.selectionText = '';
  }

  function positionButton(range) {
    const rect = range.getBoundingClientRect();
    const viewportX = Math.max(12, Math.min(window.innerWidth - 120, rect.left + rect.width / 2 - 60));
    const viewportY = Math.max(12, rect.top + window.scrollY - 44);
    selectionButton.style.left = `${window.scrollX + viewportX}px`;
    selectionButton.style.top = `${viewportY}px`;
    selectionButton.hidden = false;
  }

  function currentThreadTerm(text) {
    return `sentence:${location.pathname}:${fnv1a(text)}`;
  }

  function cloneGiscusTemplate() {
    const script = document.createElement('script');
    for (const attribute of giscusTemplate.attributes) {
      if (attribute.name === 'src') {
        continue;
      }
      script.setAttribute(attribute.name, attribute.value);
    }
    script.src = giscusTemplate.src;
    return script;
  }

  function cloneUtterancesTemplate(term) {
    const script = document.createElement('script');
    for (const attribute of utterancesTemplate.attributes) {
      if (attribute.name === 'src' || attribute.name === 'issue-term') {
        continue;
      }
      script.setAttribute(attribute.name, attribute.value);
    }
    script.src = utterancesTemplate.src;
    script.setAttribute('issue-term', term);
    return script;
  }

  function openPanel(text) {
    quote.textContent = text;
    thread.innerHTML = '';

    const term = currentThreadTerm(text);

    if (provider === 'giscus') {
      const script = cloneGiscusTemplate();
      script.setAttribute('data-mapping', 'specific');
      script.setAttribute('data-term', term);
      script.setAttribute('data-loading', 'lazy');
      thread.classList.add('giscus');
      thread.classList.remove('utterances');
      thread.appendChild(script);
    } else if (provider === 'utterances') {
      const script = cloneUtterancesTemplate(term);
      thread.classList.add('utterances');
      thread.classList.remove('giscus');
      thread.appendChild(script);
    }

    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateSelection() {
    const selection = window.getSelection();
    if (!selectionIsInsideArticle(selection)) {
      hideSelectionButton();
      return;
    }

    const text = normalizeSelection(selection.toString());
    if (!text) {
      hideSelectionButton();
      return;
    }

    state.selectionText = text;
    state.range = selection.getRangeAt(0).cloneRange();
    positionButton(state.range);
  }

  selectionButton.addEventListener('click', () => {
    if (!state.selectionText) {
      return;
    }
    openPanel(state.selectionText);
    hideSelectionButton();
    window.getSelection()?.removeAllRanges();
  });

  closeButton.addEventListener('click', () => {
    panel.hidden = true;
  });

  document.addEventListener('selectionchange', () => {
    updateSelection();
  });

  document.addEventListener('scroll', () => {
    if (selectionButton.hidden || !state.range) {
      return;
    }
    positionButton(state.range);
  }, true);

  window.addEventListener('resize', () => {
    if (selectionButton.hidden || !state.range) {
      return;
    }
    positionButton(state.range);
  });

  document.addEventListener('mousedown', (event) => {
    if (!selectionButton.hidden && !selectionButton.contains(event.target)) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideSelectionButton();
      }
    }
  });
})();