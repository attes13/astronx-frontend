// ════════════════════════════════════════════════
// API 주소 설정
// 로컬이면 localhost, 배포 환경이면 Render 주소
// ════════════════════════════════════════════════
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://astronx-backend.onrender.com';

// ════════════════════════════════════════════════
// 다크 / 라이트 모드
// ════════════════════════════════════════════════
const toggle = document.getElementById('themeToggle');

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeIcon').textContent = t === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeLabel').textContent = t === 'dark' ? '라이트모드' : '다크모드';
  localStorage.setItem('theme', t);
}
applyTheme(localStorage.getItem('theme') || 'light');
toggle.onclick = () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
};

// ════════════════════════════════════════════════
// 전역 상태
// ════════════════════════════════════════════════
let currentSort = 'sim';
let currentQuery = '';
let currentUser = null;

// ════════════════════════════════════════════════
// 정렬 버튼
// ════════════════════════════════════════════════
function setSort(sort, btn) {
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = currentQuery || document.getElementById('searchBox').value.trim();
  if (q) search(q);
}

// ════════════════════════════════════════════════
// 빠른 카테고리 검색
// ════════════════════════════════════════════════
function quickSearch(q) {
  document.getElementById('searchBox').value = q;
  search(q);
}

// ════════════════════════════════════════════════
// 일반 검색
// ════════════════════════════════════════════════
async function search(forcedQuery) {
  const q = forcedQuery || document.getElementById('searchBox').value.trim();
  if (!q) return;
  currentQuery = q;

  showSkeleton();
  setStatus(q, null);

  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&sort=${currentSort}`);
    const data = await res.json();
    renderCards(data.items, q);
  } catch (e) {
    renderEmpty('오류가 발생했어요', e.message);
  }
}

// ════════════════════════════════════════════════
// AI 자연어 검색
// ════════════════════════════════════════════════
async function aiSearch() {
  const sentence = document.getElementById('aiBox').value.trim();
  if (!sentence) return;

  showSkeleton();
  setStatus('AI 분석 중...', null);

  try {
    const res = await fetch(`${API_BASE}/api/ai-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, count: currentCount }),
      credentials: 'include',
    });

    if (res.status === 429) {
      document.getElementById('content').innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔒</div>
          <h3>오늘 AI 추천을 모두 사용했어요</h3>
          <p>로그인하면 무제한으로 사용할 수 있습니다</p>
          <a href="${API_BASE}/auth/kakao" class="kakao-login-btn"
             style="margin-top:20px;display:inline-flex">
            카카오로 로그인하기
          </a>
        </div>
      `;
      document.getElementById('statusBar').style.display = 'none';
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    renderAiResult(data);

  } catch (e) {
    renderEmpty('AI 추천 오류', e.message);
  }
}

// ════════════════════════════════════════════════
// 추천 개수 슬라이더
// ════════════════════════════════════════════════
let currentCount = 10;

function updateSlider(val) {
  currentCount = parseInt(val);
  document.getElementById('sliderValue').textContent = `${currentCount}개`;
}

// ════════════════════════════════════════════════
// 일반 검색 결과 렌더링
// ════════════════════════════════════════════════
function renderCards(items, q) {
  if (!items || !items.length) {
    renderEmpty('검색 결과가 없어요', '다른 검색어로 다시 시도해보세요');
    return;
  }
  setStatus(q, items.length);
  document.getElementById('content').innerHTML = `
    <div class="section-title">🛍️ 검색 결과</div>
    <div class="grid">${items.map(p => cardHtml(p, false)).join('')}</div>
  `;
  restoreWishHearts();
}

// ════════════════════════════════════════════════
// AI 추천 결과 렌더링
// ════════════════════════════════════════════════
function renderAiResult(data) {
  setStatus(`AI 추천: "${data.parsed.keyword}"`, data.recommendations.length);
  document.getElementById('content').innerHTML = `
    <div class="ai-summary">
      <span class="icon">✨</span>
      <span>${esc(data.summary)}</span>
    </div>
    <div class="section-title">🤖 AI 추천 결과 (${data.recommendations.length}개)</div>
    <div class="grid">${data.recommendations.map(p => cardHtml(p, true)).join('')}</div>
  `;
  restoreWishHearts();
}

// ════════════════════════════════════════════════
// 카드 HTML
// ════════════════════════════════════════════════
function cardHtml(p, isAi) {
  const rank = p.ai_rank;
  const rankLabel = rank === 1 ? '🥇 1위' : rank === 2 ? '🥈 2위' : rank === 3 ? '🥉 3위' : '';
  const dataStr = encodeURIComponent(JSON.stringify(p));

  return `
    <div class="card" onclick='openModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
      <div class="card-img-wrap">
        <img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.src=''">
        <div class="card-badges">
          ${isAi ? '<span class="badge badge-ai">AI 추천</span>' : ''}
          ${rankLabel ? `<span class="badge badge-rank">${rankLabel}</span>` : ''}
        </div>
        <button class="wish-btn"
          id="wish-${esc(p.id)}"
          data-product="${dataStr}"
          onclick="event.stopPropagation(); toggleWish(this)">
          🤍
        </button>
      </div>
      <div class="card-body">
        ${p.brand ? `<div class="card-brand">${esc(p.brand)}</div>` : ''}
        <div class="card-title">${esc(p.title)}</div>
        <div class="card-price-row">
          <span class="card-price">${p.price.toLocaleString()}원</span>
        </div>
        <div class="card-mall">${esc(p.mall)}</div>
        ${p.reason ? `<div class="ai-reason">💡 ${esc(p.reason)}</div>` : ''}
        <a href="${esc(p.link)}" target="_blank" rel="noopener" class="card-buy"
           onclick="event.stopPropagation()">구매하러 가기 →</a>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════
// 찜하기 토글
// ════════════════════════════════════════════════
async function toggleWish(btn) {
  const product = JSON.parse(decodeURIComponent(btn.dataset.product));

  if (!currentUser) {
    if (confirm('찜하기는 로그인이 필요합니다. 카카오로 로그인할까요?')) {
      window.location.href = `${API_BASE}/auth/kakao`;
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/wishlist/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id,  // ← 유저 ID 헤더로 전송
      },
      body: JSON.stringify(product),
      credentials: 'include',
    });
    const data = await res.json();

    btn.textContent = data.action === 'added' ? '❤️' : '🤍';
    document.getElementById('wishCount').textContent =
      data.total > 0 ? `❤️ ${data.total}` : '❤️ 찜';

  } catch (e) {
    console.error('찜하기 오류:', e);
  }
}

// ════════════════════════════════════════════════
// 찜 상태 복원
// ════════════════════════════════════════════════
async function restoreWishHearts() {
  if (!currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/api/wishlist/ids`, {
      credentials: 'include',
      headers: { 'x-user-id': currentUser.id },
    });
    const data = await res.json();

    data.ids.forEach(productId => {
      const btn = document.getElementById(`wish-${productId}`);
      if (btn) btn.textContent = '❤️';
    });

    if (data.ids.length > 0) {
      document.getElementById('wishCount').textContent = `❤️ ${data.ids.length}`;
    }
  } catch (e) {
    console.error('찜 상태 복원 오류:', e);
  }
}

// ════════════════════════════════════════════════
// 찜 목록 보기
// ════════════════════════════════════════════════
async function openWishlist() {
  if (!currentUser) {
    if (confirm('찜 목록은 로그인이 필요합니다. 카카오로 로그인할까요?')) {
      window.location.href = `${API_BASE}/auth/kakao`;
    }
    return;
  }

  const res = await fetch(`${API_BASE}/api/wishlist`, {
    credentials: 'include',
    headers: { 'x-user-id': currentUser.id },
  });
  const data = await res.json();

  if (!data.items.length) {
    alert('찜한 상품이 없습니다. 마음에 드는 상품에 하트를 눌러보세요!');
    return;
  }

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2>❤️ 찜 목록 (${data.items.length}개)</h2>
        <button onclick="deleteAllWish()"
          style="padding:6px 12px;background:#FF5722;color:#fff;border:none;
                 border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">
          전체 삭제
        </button>
      </div>
      <div id="wishlistItems"
           style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto">
        ${data.items.map(p => wishItemHtml(p)).join('')}
      </div>
      <button class="modal-close-btn" style="margin-top:16px;width:100%"
              onclick="closeModal()">닫기</button>
    </div>
  `;
  document.getElementById('overlay').classList.add('show');
}

// ════════════════════════════════════════════════
// 단건 삭제
// ════════════════════════════════════════════════
async function deleteOneWish(productId) {
  if (!confirm('이 상품을 찜 목록에서 삭제할까요?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/wishlist/${productId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-user-id': currentUser.id },
    });
    const data = await res.json();

    const item = document.getElementById(`wish-item-${productId}`);
    if (item) item.remove();

    const heartBtn = document.getElementById(`wish-${productId}`);
    if (heartBtn) heartBtn.textContent = '🤍';

    document.getElementById('wishCount').textContent =
      data.total > 0 ? `❤️ ${data.total}` : '❤️ 찜';

    if (data.total === 0) closeModal();

  } catch (e) {
    console.error('찜 삭제 오류:', e);
  }
}

// ════════════════════════════════════════════════
// 전체 삭제
// ════════════════════════════════════════════════
async function deleteAllWish() {
  if (!confirm('찜 목록을 전부 삭제할까요?')) return;

  try {
    await fetch(`${API_BASE}/api/wishlist/all`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-user-id': currentUser.id },
    });

    document.querySelectorAll('.wish-btn').forEach(btn => {
      btn.textContent = '🤍';
    });

    document.getElementById('wishCount').textContent = '❤️ 찜';
    closeModal();
    alert('찜 목록을 모두 삭제했습니다.');

  } catch (e) {
    console.error('전체 삭제 오류:', e);
  }
}

// ════════════════════════════════════════════════
// 상품 상세 모달
// ════════════════════════════════════════════════
function openModal(p) {
  document.getElementById('modalBody').innerHTML = `
    <img class="modal-img" src="${esc(p.image)}" alt="">
    <div class="modal-body">
      ${p.brand ? `<div class="modal-brand">${esc(p.brand)}</div>` : ''}
      <div class="modal-title">${esc(p.title)}</div>
      <div class="modal-price">${p.price.toLocaleString()}원</div>
      <div class="modal-mall">${esc(p.mall)}</div>
      ${p.reason
        ? `<div class="ai-reason" style="margin-bottom:16px">💡 ${esc(p.reason)}</div>`
        : ''}
      <div class="modal-actions">
        <button class="modal-close-btn" onclick="closeModal()">닫기</button>
        <a href="${esc(p.link)}" target="_blank" rel="noopener" class="modal-buy-btn">
          구매하러 가기 →
        </a>
      </div>
    </div>
  `;
  document.getElementById('overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('show');
}

// ════════════════════════════════════════════════
// 로그인 상태 확인 및 헤더 표시
// ════════════════════════════════════════════════
async function checkLogin() {
  const area = document.getElementById('authArea');
  if (currentUser) {
    area.innerHTML = `
      <div class="user-info">
        ${currentUser.profileImage
          ? `<img src="${esc(currentUser.profileImage)}" class="user-avatar">`
          : `<div class="user-avatar-placeholder"></div>`}
        <span class="user-name">${esc(currentUser.nickname)}</span>
        <a href="#" onclick="logout()" class="logout-btn">로그아웃</a>
      </div>
    `;
  } else {
    area.innerHTML = `
      <a href="${API_BASE}/auth/kakao" class="kakao-login-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#3A1D1D">
          <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.68 5.1 4.2 6.6L5.1 21l4.5-2.4c.78.12 1.59.18 2.4.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
        </svg>
        카카오로 시작하기
      </a>
    `;
  }
}

function logout() {
  localStorage.removeItem('astronx_user');
  currentUser = null;
  window.location.href = `${API_BASE}/auth/logout`;
}

// ════════════════════════════════════════════════
// XSS 방지
// ════════════════════════════════════════════════
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════
// 상태 표시줄
// ════════════════════════════════════════════════
function setStatus(text, count) {
  const bar = document.getElementById('statusBar');
  bar.style.display = 'flex';
  document.getElementById('statusText').textContent = text;
  document.getElementById('statusCount').textContent =
    count !== null ? `${count}개` : '';
}

// ════════════════════════════════════════════════
// 스켈레톤 로딩
// ════════════════════════════════════════════════
function showSkeleton() {
  const cards = Array.from({ length: 8 }).map(() => `
    <div class="skel">
      <div class="skel-img"></div>
      <div class="skel-body">
        <div class="skel-line short"></div>
        <div class="skel-line"></div>
        <div class="skel-line xshort"></div>
      </div>
    </div>
  `).join('');
  document.getElementById('content').innerHTML =
    `<div class="skeleton-grid">${cards}</div>`;
}

// ════════════════════════════════════════════════
// 빈 화면
// ════════════════════════════════════════════════
function renderEmpty(title, desc) {
  document.getElementById('content').innerHTML = `
    <div class="empty">
      <div class="empty-icon">😕</div>
      <h3>${esc(title)}</h3>
      <p>${esc(desc)}</p>
    </div>
  `;
  document.getElementById('statusBar').style.display = 'none';
}

// ════════════════════════════════════════════════
// 첫 로딩 — 인기 상품 + 로그인 상태 확인
// ════════════════════════════════════════════════
(async () => {
  // URL 파라미터 먼저 처리
  const urlParams = new URLSearchParams(window.location.search);
  const loginParam = urlParams.get('login');
  const userParam = urlParams.get('user');
  const errorParam = urlParams.get('error');

  if (errorParam === 'login_failed') {
    alert('로그인에 실패했습니다. 다시 시도해주세요.');
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (loginParam === 'success' && userParam) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userParam));
      localStorage.setItem('astronx_user', JSON.stringify(currentUser));
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {
      console.error('유저 정보 파싱 오류:', e);
    }
  } else {
    // localStorage에서 복원
    const savedUser = localStorage.getItem('astronx_user');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem('astronx_user');
      }
    }
  }

  // 헤더 업데이트
  const area = document.getElementById('authArea');
  if (currentUser) {
    area.innerHTML = `
      <div class="user-info">
        ${currentUser.profileImage
          ? `<img src="${esc(currentUser.profileImage)}" class="user-avatar">`
          : `<div class="user-avatar-placeholder"></div>`}
        <span class="user-name">${esc(currentUser.nickname)}</span>
        <a href="#" onclick="logout()" class="logout-btn">로그아웃</a>
      </div>
    `;
  } else {
    area.innerHTML = `
      <a href="${API_BASE}/auth/kakao" class="kakao-login-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#3A1D1D">
          <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.68 5.1 4.2 6.6L5.1 21l4.5-2.4c.78.12 1.59.18 2.4.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
        </svg>
        카카오로 시작하기
      </a>
    `;
  }

  // 상품 로딩
  showSkeleton();
  try {
    const res = await fetch(`${API_BASE}/api/search?q=베스트상품&sort=sim`);
    const data = await res.json();
    currentQuery = '베스트상품';
    renderCards(data.items, '추천 상품');
  } catch {
    renderEmpty('상품을 불러올 수 없어요', '잠시 후 다시 시도해주세요');
  }
})();