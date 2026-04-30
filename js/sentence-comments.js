(() => {
  const article = document.querySelector('[itemprop="articleBody"]');
  if (!article) {
    return;
  }

  const commentsSection = document.getElementById('comments');
  const utterancesTemplate = commentsSection
    ? commentsSection.querySelector('script[src*="utteranc.es/client.js"]')
    : null;
  const giscusTemplate = commentsSection
    ? commentsSection.querySelector('script[src*="giscus.app/client.js"]')
    : null;

  let repoConfig = null;
  if (utterancesTemplate) {
    repoConfig = {
      repo: utterancesTemplate.getAttribute('repo'),
      provider: 'utterances'
    };
  } else if (giscusTemplate) {
    repoConfig = {
      repo: giscusTemplate.getAttribute('data-repo'),
      provider: 'giscus'
    };
  }

  if (!repoConfig) {
    return;
  }

  function fnv1a(input) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function currentThreadTerm(text) {
    return `sentence:${location.pathname}:${fnv1a(text)}`;
  }

  async function fetchCommentsCount(term) {
    try {
      const searchQuery = `repo:${repoConfig.repo} is:issue "${term}"`;
      const apiUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) return 0;
      
      const data = await response.json();
      if (!data.items || data.items.length === 0) return 0;
      
      return data.items[0].comments || 0;
    } catch (e) {
      console.error('[sentence-comments] Error:', e);
      return 0;
    }
  }

  async function fetchComments(term) {
    try {
      const searchQuery = `repo:${repoConfig.repo} is:issue "${term}"`;
      const apiUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) return [];
      
      const data = await response.json();
      if (!data.items || data.items.length === 0) return [];
      
      const issue = data.items[0];
      const commentsUrl = `https://api.github.com/repos/${repoConfig.repo}/issues/${issue.number}/comments`;
      
      const commentsResponse = await fetch(commentsUrl);
      if (!commentsResponse.ok) return [];
      
      return await commentsResponse.json();
    } catch (e) {
      console.error('[sentence-comments] Error:', e);
      return [];
    }
  }

  function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'sentence-comment-item';
    div.innerHTML = `
      <div class="sentence-comment-avatar">
        <img src="${comment.user.avatar_url}" alt="${comment.user.login}" />
      </div>
      <div class="sentence-comment-body">
        <div class="sentence-comment-header">
          <strong>${comment.user.login}</strong>
        </div>
        <div class="sentence-comment-content">${comment.body}</div>
      </div>
    `;
    return div;
  }

  function createCommentMarker(count, term) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'sentence-comment-annotation-marker';
    marker.textContent = `💬 ${count}`;
    marker.title = '查看评论';
    
    marker.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const comments = await fetchComments(term);
      
      if (comments.length === 0) {
        const popup = document.createElement('div');
        popup.className = 'sentence-comment-popup';
        popup.innerHTML = `
          <div class="sentence-comment-popup-header">暂无评论</div>
          <div class="sentence-comment-popup-cta">
            <a href="#comments" class="sentence-comment-link">点击去添加评论 →</a>
          </div>
        `;
        
        const rect = marker.getBoundingClientRect();
        popup.style.left = (rect.right + 10) + 'px';
        popup.style.top = rect.top + 'px';
        document.body.appendChild(popup);
        
        setTimeout(() => {
          const close = () => {
            popup.remove();
            document.removeEventListener('click', close);
          };
          document.addEventListener('click', close);
        }, 0);
        return;
      }
      
      const popup = document.createElement('div');
      popup.className = 'sentence-comment-popup';
      
      comments.forEach(comment => {
        popup.appendChild(createCommentElement(comment));
      });
      
      const rect = marker.getBoundingClientRect();
      popup.style.left = (rect.right + 10) + 'px';
      popup.style.top = rect.top + 'px';
      document.body.appendChild(popup);
      
      setTimeout(() => {
        const close = () => {
          popup.remove();
          document.removeEventListener('click', close);
        };
        document.addEventListener('click', close);
      }, 0);
    });
    
    return marker;
  }

  function extractSentences() {
    const walker = document.createTreeWalker(
      article,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const sentences = [];
    let currentText = '';
    let currentNode = null;
    
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      if (!text.trim()) continue;
      
      currentText += text;
      if (!currentNode) currentNode = node;
      
      if (/[。！？!?]/.test(text)) {
        if (currentText.trim().length > 10) {
          sentences.push({
            text: normalizeText(currentText),
            node: currentNode
          });
        }
        currentText = '';
        currentNode = null;
      }
    }
    
    if (currentText.trim().length > 10) {
      sentences.push({
        text: normalizeText(currentText),
        node: currentNode
      });
    }
    
    return sentences;
  }

  async function scanAndMarkComments() {
    const sentences = extractSentences();
    
    for (const sentence of sentences) {
      const term = currentThreadTerm(sentence.text);
      const count = await fetchCommentsCount(term);
      
      if (count > 0) {
        const marker = createCommentMarker(count, term);
        
        if (sentence.node.parentNode) {
          sentence.node.parentNode.insertBefore(marker, sentence.node.nextSibling);
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    scanAndMarkComments();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndMarkComments);
  } else {
    scanAndMarkComments();
  }
})();
