// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUserId = null;

// ========== SIMPLE ML / AI LAYER ==========
const VOCAB = [
  'rice','paddy','wheat','maize','corn','cotton','vegetable','tomato','chilli','onion',
  'irrigation','drip','sprinkler','canal','flood','watering',
  'fertilizer','urea','npk','compost','organic','manure',
  'pest','disease','fungus','bacterial','insect','worm',
  'harvest','yield','flowering','sowing','seedling','transplant',
  'rain','drought','humidity','temperature','heat'
];

let userInterestVector = new Array(VOCAB.length).fill(0);

function embedText(text) {
  const vec = new Array(VOCAB.length).fill(0);
  if (!text) return vec;
  const tokens = text.toLowerCase().split(/[^a-z]+/);
  tokens.forEach(t => {
    const idx = VOCAB.indexOf(t);
    if (idx !== -1) vec[idx] += 1;
  });
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function updateUserInterestFromPost(post) {
  const vec = embedText(post.content || '');
  for (let i = 0; i < userInterestVector.length; i++) {
    userInterestVector[i] = userInterestVector[i] * 0.9 + vec[i] * 0.3;
  }
}

function computeBaseScore(p) {
  const likes = p.likes || 0;
  const views = p.views || 0;
  const comments = p.commentsCount || 0;
  const hours = (Date.now() - (p.timestamp || Date.now())) / (1000 * 3600);
  const recency = Math.max(0, (48 - hours) / 48);
  return likes * 3 + comments * 5 + views + recency * 10;
}

// ========== AUTH ==========
auth.signInAnonymously().catch(error => {
  console.error('Auth error:', error);
});

auth.onAuthStateChanged(user => {
  if (user) {
    currentUserId = user.uid;
    console.log('✅ User signed in:', currentUserId);
    loadFeed();
    loadTrending();
    getWeatherByGeolocation();
  }
});

// ========== WEATHER (OpenWeather) ==========
function getWeatherByGeolocation() {
  const weatherContent = document.getElementById('weatherContent');
  if (!weatherContent) return;

  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'YOUR_OPENWEATHER_API_KEY') {
    weatherContent.textContent = 'Weather API key not configured.';
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchOpenWeather(pos.coords.latitude, pos.coords.longitude),
      () => { weatherContent.textContent = 'Location blocked. Try city search.'; }
    );
  } else {
    weatherContent.textContent = 'Geolocation not supported.';
  }
}

async function fetchOpenWeather(lat, lon, labelOverride) {
  const weatherContent = document.getElementById('weatherContent');
  if (!weatherContent) return;
  
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    const data = await res.json();
    if (!res.ok || !data.main) throw new Error('Weather error');

    const temp = Math.round(data.main.temp);
    const hum = data.main.humidity;
    const desc = data.weather && data.weather[0] ? data.weather[0].description : 'Weather';
    const label = labelOverride || data.name || 'Your field';

    weatherContent.textContent = `${label}: ${desc}, ${temp}°C • Humidity ${hum}%`;
  } catch (e) {
    console.error('Weather error:', e);
    weatherContent.textContent = 'Weather fetch failed.';
  }
}

async function geocodeCityToCoords(name) {
  if (!OPENWEATHER_API_KEY) throw new Error('Missing OpenWeather API key');
  
  const res = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${OPENWEATHER_API_KEY}`
  );
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error('City not found');
  return { lat: data[0].lat, lon: data[0].lon, label: `${data[0].name}, ${data[0].country}` };
}

// City search handler
(function initWeatherCityHandler() {
  const btn = document.getElementById('cityBtn');
  const input = document.getElementById('cityInput');
  const weatherContent = document.getElementById('weatherContent');
  if (!btn || !input || !weatherContent) return;

  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return;
    weatherContent.textContent = 'Loading...';
    try {
      const { lat, lon, label } = await geocodeCityToCoords(name);
      await fetchOpenWeather(lat, lon, label);
    } catch (e) {
      weatherContent.textContent = e.message === 'City not found' ? 'City not found.' : 'Weather error.';
    }
  });
})();

// ========== FEED & POSTS ==========
async function loadFeed() {
  try {
    const snapshot = await db.collection('posts').orderBy('timestamp', 'desc').limit(50).get();
    const posts = [];
    
    snapshot.forEach(doc => {
      const p = doc.data();
      p.id = doc.id;
      p._baseScore = computeBaseScore(p);
      p._embedding = embedText(p.content || '');
      p._similarity = cosineSim(p._embedding, userInterestVector);
      p._totalScore = p._baseScore * 0.7 + p._similarity * 10 * 0.3;
      posts.push(p);
    });

    posts.sort((a, b) => b._totalScore - a._totalScore);

    const list = document.getElementById('feedList');
    if (list) {
      list.innerHTML = posts.length ? '' : 'No posts yet. Be the first to share!';
      posts.forEach(p => {
        const node = renderPost(p);
        list.appendChild(node);
      });
    }

    renderRecommended(posts);
  } catch (error) {
    console.error('Feed load error:', error);
    const list = document.getElementById('feedList');
    if (list) list.textContent = 'Error loading posts.';
  }
}

function renderPost(p) {
  const div = document.createElement('div');
  div.className = 'post';
  div.innerHTML = `
    <div class="meta">Posted • ${timeAgo(p.timestamp)}</div>
    <div class="content">${escapeHtml(p.content || '')}</div>
  `;
  if (p.mediaUrl) {
    if (p.mediaType === 'image') {
      const img = document.createElement('img');
      img.src = p.mediaUrl;
      img.style = 'max-width:100%;border-radius:8px;margin-top:8px;';
      div.appendChild(img);
    }
  }
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.style = 'display:flex;gap:8px;margin-top:8px;';
  
  const likeBtn = document.createElement('button');
  likeBtn.textContent = `👍 ${p.likes || 0}`;
  likeBtn.onclick = async () => {
    updateUserInterestFromPost(p);
    await db.collection('posts').doc(p.id).update({
      likes: firebase.firestore.FieldValue.increment(1)
    });
    loadFeed();
    loadTrending();
  };
  
  controls.appendChild(likeBtn);
  div.appendChild(controls);
  return div;
}

function renderRecommended(allPosts) {
  const container = document.getElementById('recommendedList');
  if (!container) return;
  
  const candidates = allPosts
    .filter(p => p._similarity > 0.05)
    .sort((a, b) => b._similarity - a._similarity)
    .slice(0, 5);

  if (!candidates.length) {
    container.textContent = 'Interact with posts to get recommendations.';
    return;
  }

  container.innerHTML = '';
  candidates.forEach(p => {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
      <div class="meta">Suggested • ${(p._similarity * 100).toFixed(0)}% match</div>
      <div class="content">${escapeHtml((p.content || '').slice(0, 160))}</div>
    `;
    container.appendChild(div);
  });
}

// ========== TRENDING ==========
async function loadTrending() {
  try {
    const snap = await db.collection('posts').limit(100).get();
    const arr = [];
    snap.forEach(d => {
      const p = d.data();
      p.id = d.id;
      const base = computeBaseScore(p);
      arr.push({ p, score: base });
    });
    arr.sort((a, b) => b.score - a.score);
    
    const list = document.getElementById('trendingList');
    if (list) {
      list.innerHTML = arr.length ? '' : 'No trending posts yet.';
      arr.slice(0, 5).forEach(item => {
        const el = document.createElement('div');
        el.className = 'trending-item';
        el.textContent = `${(item.p.content || '[media]').slice(0, 80)}`;
        list.appendChild(el);
      });
    }
  } catch (error) {
    console.error('Trending load error:', error);
  }
}

// ========== HELPERS ==========
function timeAgo(timestamp) {
  if (!timestamp) return 'recently';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('✅ app.js loaded successfully');
