(() => {
  'use strict';

  const STORAGE_KEY = 'pocket-play-state-v1';
  const VOICE_STORAGE_KEY = 'pocket-play-voice-v1';
  // 全站語音導播總開關:所有遊戲的語音提示都受它控制(各遊戲內還有自己的開關)。
  let globalVoice = true;
  const MAX_WHEEL_OPTIONS = 12;
  const DICE_PIPS = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
  };
  const WHEEL_COLORS = ['#9e7bff', '#ff806f', '#ffcf56', '#70c6ff', '#80e8a5', '#ec8fd0', '#d8ff5f', '#f39a63', '#7fd8d2', '#b4a1ff', '#ff9d9d', '#c4db6c'];
  const WHEEL_PRESETS = {
    party: ['真心話', '請喝一口水', '左邊的人選歌', '做 5 下深蹲', '免做一次', '指定一人表演'],
    reward: ['免費甜點', '下一局先手', '獲得小禮物', '多一次機會', '大家替你鼓掌', '指定一人幫忙'],
    penalty: ['做 5 下深蹲', '模仿一種動物', '下一局最後手', '唱一句歌', '講一個冷笑話', '喝一口水'],
  };
  const TAU = Math.PI * 2;
  const WOLF_ROLES = {
    werewolf: { name: '狼人', emoji: '🐺', camp: 'wolf', desc: '每晚和同伴一起選擇一名玩家殺害。白天偽裝成村民,別被發現。' },
    villager: { name: '村民', emoji: '👤', camp: 'village', desc: '沒有特殊能力。靠推理和發言找出狼人,白天投票放逐。' },
    seer: { name: '預言家', emoji: '🔮', camp: 'village', desc: '每晚可以查驗一名玩家的身份,是好人還是狼人。' },
    witch: { name: '女巫', emoji: '🧪', camp: 'village', desc: '有一瓶解藥和一瓶毒藥。解藥可救活當晚被殺的人,毒藥可直接毒死一人;兩種藥各只能用一次。' },
    hunter: { name: '獵人', emoji: '🔫', camp: 'village', desc: '被放逐或毒死時,可以開槍帶走一名玩家。' },
    guard: { name: '守衛', emoji: '🛡️', camp: 'village', desc: '每晚可以守護一名玩家,被守護的人當晚不會被狼人殺死。不能連續兩晚守同一個人。' },
    idiot: { name: '白痴', emoji: '🙃', camp: 'village', desc: '被投票放逐時可以翻牌免死,之後失去投票權但可以繼續發言。' },
  };
  const WOLF_PRESETS = [
    { id: 'mini6', ver: 'A', label: '版本 A · 6 人新手局', desc: '適配 6 人 · 約 15 分鐘 · 狼×2', roles: ['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager'] },
    { id: 'classic8', ver: 'B', label: '版本 B · 8 人經典局', desc: '適配 8 人 · 約 25 分鐘 · 狼×3', roles: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager'] },
    { id: 'pro10', ver: 'C', label: '版本 C · 10 人進階局', desc: '適配 10 人 · 約 30 分鐘 · 狼×4', roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager'] },
    { id: 'standard12', ver: 'D', label: '版本 D · 12 人標準局', desc: '適配 12 人 · 約 40 分鐘 · 狼×4', roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager'] },
  ];

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const randomInt = (max) => Math.floor(Math.random() * max);
  const pad = (value) => String(value).padStart(2, '0');
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

  const defaultState = () => ({
    dice: {
      count: 5,
      sides: 6,
      values: Array.from({ length: 5 }, () => randomInt(6) + 1),
      rolls: 1,
    },
    wheel: {
      options: [...WHEEL_PRESETS.party],
    },
    teamShuffle: {
      peopleCount: 4,
      teamCount: 2,
      names: ['阿明', '小美', '阿哲', '小安'],
      lastTeams: [],
    },
    score: {
      count: 4,
      entries: [
        { name: '玩家 1', score: 0, round: 0 },
        { name: '玩家 2', score: 0, round: 0 },
        { name: '玩家 3', score: 0, round: 0 },
        { name: '玩家 4', score: 0, round: 0 },
      ],
    },
    timer: {
      preset: 60,
      remaining: 60,
    },
    cards: {
      texas: { bankroll: 1000, dealerBankroll: 1000, rounds: 0, wins: 0 },
      bj: { bankroll: 1000, rounds: 0, wins: 0 },
      bac: { bankroll: 1000, rounds: 0, wins: 0 },
    },
  });

  const validString = (value, fallback) => (typeof value === 'string' ? value : fallback);

  function loadState() {
    const initial = defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return initial;

      const dice = saved.dice && typeof saved.dice === 'object' ? saved.dice : {};
      const count = clamp(Number(dice.count) || initial.dice.count, 1, 12);
      const sides = clamp(Number(dice.sides) || initial.dice.sides, 2, 100);
      const savedValues = Array.isArray(dice.values) ? dice.values : [];
      const values = Array.from({ length: count }, (_, index) => {
        const value = Number(savedValues[index]);
        return Number.isFinite(value) && value >= 1 && value <= sides ? Math.floor(value) : randomInt(sides) + 1;
      });

      const options = saved.wheel && Array.isArray(saved.wheel.options)
        ? saved.wheel.options.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, MAX_WHEEL_OPTIONS)
        : initial.wheel.options;

      const legacyNames = validString(saved.pickerEntries, '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
      const savedShuffle = saved.teamShuffle && typeof saved.teamShuffle === 'object' ? saved.teamShuffle : {};
      const peopleCount = clamp(Number(savedShuffle.peopleCount) || legacyNames.length || initial.teamShuffle.peopleCount, 2, 24);
      const namesSource = Array.isArray(savedShuffle.names) ? savedShuffle.names : legacyNames;
      const names = Array.from({ length: peopleCount }, (_, index) => {
        const name = validString(namesSource[index], '').trim();
        return name || `玩家 ${index + 1}`;
      });
      const teamCount = clamp(Number(savedShuffle.teamCount) || initial.teamShuffle.teamCount, 2, Math.min(8, peopleCount));
      const lastTeams = Array.isArray(savedShuffle.lastTeams)
        ? savedShuffle.lastTeams.filter((team) => Array.isArray(team)).map((team) => team.filter((name) => typeof name === 'string')).slice(0, 8)
        : [];

      const savedScore = saved.score && typeof saved.score === 'object' ? saved.score : {};
      const legacyScoreEntries = [
        { name: validString(savedScore.aName, '我們隊'), score: clamp(Math.floor(Number(savedScore.a) || 0), -999999, 999999) },
        { name: validString(savedScore.bName, '朋友隊'), score: clamp(Math.floor(Number(savedScore.b) || 0), -999999, 999999) },
      ];
      const scoreSource = Array.isArray(savedScore.entries) ? savedScore.entries : legacyScoreEntries;
      const scoreCount = clamp(Number(savedScore.count) || scoreSource.length || initial.score.count, 2, 12);
      const scoreEntries = Array.from({ length: scoreCount }, (_, index) => {
        const entry = scoreSource[index] && typeof scoreSource[index] === 'object' ? scoreSource[index] : {};
        return {
          name: validString(entry.name, `玩家 ${index + 1}`).trim().slice(0, 14) || `玩家 ${index + 1}`,
          score: clamp(Math.floor(Number(entry.score) || 0), -999999, 999999),
          round: clamp(Math.floor(Number(entry.round) || 0), 0, 999999),
        };
      });

      return {
        dice: {
          count,
          sides,
          values,
          rolls: Math.max(1, Math.floor(Number(dice.rolls) || initial.dice.rolls)),
        },
        wheel: { options: options.length >= 2 ? options : [...initial.wheel.options] },
        teamShuffle: { peopleCount, teamCount, names, lastTeams },
        score: {
          count: scoreCount,
          entries: scoreEntries,
        },
        timer: {
          preset: [30, 60, 180].includes(Number(saved.timer?.preset)) ? Number(saved.timer.preset) : initial.timer.preset,
          remaining: clamp(Number.isFinite(Number(saved.timer?.remaining)) ? Math.floor(Number(saved.timer.remaining)) : (Number(saved.timer?.preset) || initial.timer.remaining), 0, 3600),
        },
        cards: {
          texas: {
            bankroll: clamp(Math.floor(Number(saved.cards?.texas?.bankroll) || initial.cards.texas.bankroll), 0, 999999),
            dealerBankroll: clamp(Math.floor(Number(saved.cards?.texas?.dealerBankroll) || initial.cards.texas.dealerBankroll), 0, 999999),
            rounds: Math.max(0, Math.floor(Number(saved.cards?.texas?.rounds) || 0)),
            wins: Math.max(0, Math.floor(Number(saved.cards?.texas?.wins) || 0)),
          },
          bj: {
            bankroll: clamp(Math.floor(Number(saved.cards?.bj?.bankroll) || initial.cards.bj.bankroll), 0, 999999),
            rounds: Math.max(0, Math.floor(Number(saved.cards?.bj?.rounds) || 0)),
            wins: Math.max(0, Math.floor(Number(saved.cards?.bj?.wins) || 0)),
          },
          bac: {
            bankroll: clamp(Math.floor(Number(saved.cards?.bac?.bankroll) || initial.cards.bac.bankroll), 0, 999999),
            rounds: Math.max(0, Math.floor(Number(saved.cards?.bac?.rounds) || 0)),
            wins: Math.max(0, Math.floor(Number(saved.cards?.bac?.wins) || 0)),
          },
        },
      };
    } catch (error) {
      return initial;
    }
  }

  let state = loadState();
  let toastTimeout;
  let timerInterval = null;
  let coinBusy = false;
  let wheelSpinning = false;
  let wheelRotation = 0;
  let motionActive = false;
  let motionListenerAttached = false;
  let lastMotion = null;
  let lastShakeAt = 0;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Private browsing or a full storage quota should not stop the games.
    }
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function vibrate(pattern = 30) {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  }

  // Navigation: 首頁 → 四大分類 → 單一遊戲／工具
  function switchView(viewName) {
    const target = document.getElementById(`view-${viewName}`);
    if (!target) return;
    $$('.app-view').forEach((view) => {
      const active = view === target;
      view.classList.toggle('is-active', active);
      view.hidden = !active;
    });
    if (viewName === 'wheel') window.setTimeout(drawWheel, 30);
    if (viewName === 'texas') window.setTimeout(renderTexas, 30);
    if (viewName === 'bj') window.setTimeout(renderBlackjack, 30);
    if (viewName === 'bac') window.setTimeout(renderBaccarat, 30);
    window.scrollTo(0, 0);
  }

  function scrollToAnchor(anchorId) {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    window.setTimeout(() => {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  document.addEventListener('click', (event) => {
    const goHome = event.target.closest('[data-go-home]');
    const back = event.target.closest('[data-back]');
    const category = event.target.closest('[data-category]');
    const game = event.target.closest('[data-game]');

    if (goHome) {
      switchView('home');
      return;
    }
    if (back) {
      switchView(back.dataset.back || 'home');
      return;
    }
    if (category) {
      switchView(`cat-${category.dataset.category}`);
      return;
    }
    if (game) {
      switchView(game.dataset.game);
      if (game.dataset.anchor) scrollToAnchor(game.dataset.anchor);
      if (game.dataset.game === 'dice' && game.dataset.anchor === 'diceSync') {
        showToast('在多人骰子房切到「隱藏」就是大話骰');
      }
      return;
    }
  });

  // Connection indicator: the app is designed to work regardless of this value.
  function updateConnectionStatus() {
    const badge = $('#connectionBadge');
    const text = $('#connectionText');
    const online = navigator.onLine;
    badge.classList.toggle('is-online', online);
    text.textContent = online ? '已連線 · 可離線玩' : '離線可用';
  }

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  // Dice
  const diceCountInput = $('#diceCount');
  const diceSidesInput = $('#diceSides');
  const diceGrid = $('#diceGrid');
  const diceStage = $('#diceStage');
  const rollStatus = $('#rollStatus');
  const motionStatus = $('#motionStatus');
  const motionSubstatus = $('#motionSubstatus');
  const shakeIcon = $('#shakeIcon');

  function createPipFace(value) {
    const pipFace = document.createElement('span');
    pipFace.className = 'pip-face';
    (DICE_PIPS[value] || []).forEach((position) => {
      const pip = document.createElement('span');
      pip.className = `pip ${position}`;
      pipFace.appendChild(pip);
    });
    return pipFace;
  }

  function updateDiceStatus() {
    rollStatus.textContent = pad(state.dice.rolls);
    diceCountInput.value = state.dice.count;
    diceSidesInput.value = state.dice.sides;
    $$('.preset-button').forEach((button) => {
      button.classList.toggle('is-selected', Number(button.dataset.sides) === state.dice.sides);
    });
  }

  function buildDie(value, sides, small = false) {
    const die = document.createElement('div');
    die.className = small ? 'die die-small' : 'die';
    die.setAttribute('aria-label', `骰子 ${value}`);
    const dieValue = document.createElement('span');
    dieValue.className = 'die-value';
    dieValue.setAttribute('aria-hidden', 'true');
    if (sides === 6) {
      dieValue.appendChild(createPipFace(value));
    } else {
      const numeric = document.createElement('span');
      numeric.className = 'numeric-face';
      numeric.textContent = String(value);
      dieValue.appendChild(numeric);
    }
    die.appendChild(dieValue);
    return die;
  }

  function renderDice(animate = false) {
    diceGrid.replaceChildren();
    state.dice.values.forEach((value, index) => {
      const die = buildDie(value, state.dice.sides);
      diceGrid.appendChild(die);
      if (animate) {
        window.setTimeout(() => die.classList.add('is-bumped'), index * 35);
      }
    });
    updateDiceStatus();
  }

  function setMotionCopy(title, subtitle) {
    motionStatus.textContent = title;
    motionSubstatus.textContent = subtitle;
  }

  function rerollDice(source = 'shake') {
    if (diceSync.mode !== 'local') {
      state.dice.values = Array.from({ length: state.dice.count }, () => randomInt(state.dice.sides) + 1);
      if (source === 'shake') state.dice.rolls += 1;
      saveState();
      renderDice(true);
      if (diceSync.mode === 'client') {
        sendToDiceHost({ type: 'roll', slot: diceSync.mySlot, values: [...state.dice.values] });
      } else if (diceSync.mode === 'host') {
        if (diceSync.players[0]) {
          diceSync.players[0].values = [...state.dice.values];
          diceSync.players[0].lastAt = Date.now();
        }
        renderDiceTable();
        broadcastDiceState();
      }
      shakeIcon.classList.remove('is-shaking');
      // Restarting the class makes consecutive shakes animate as well.
      void shakeIcon.offsetWidth;
      shakeIcon.classList.add('is-shaking');
      if (source === 'shake') {
        setMotionCopy(`已擲骰 · 第 ${state.dice.rolls} 次`, '結果已同步給房間裡的大家。');
        vibrate([25, 30, 45]);
      } else {
        setMotionCopy('已擲骰', '結果已同步給房間裡的大家。');
        vibrate(20);
      }
      return;
    }
    state.dice.values = Array.from({ length: state.dice.count }, () => randomInt(state.dice.sides) + 1);
    if (source === 'shake') state.dice.rolls += 1;
    saveState();
    renderDice(true);
    shakeIcon.classList.remove('is-shaking');
    // Restarting the class makes consecutive shakes animate as well.
    void shakeIcon.offsetWidth;
    shakeIcon.classList.add('is-shaking');
    if (source === 'shake') {
      setMotionCopy(`已換骰 · 第 ${state.dice.rolls} 次`, '按住骰面查看；下一次仍需搖動。');
      vibrate([25, 30, 45]);
    }
  }

  function applyDiceSettings() {
    const count = clamp(Math.floor(Number(diceCountInput.value) || state.dice.count), 1, 12);
    const sides = clamp(Math.floor(Number(diceSidesInput.value) || state.dice.sides), 2, 100);
    diceCountInput.value = count;
    diceSidesInput.value = sides;
    const changed = count !== state.dice.count || sides !== state.dice.sides;
    state.dice.count = count;
    state.dice.sides = sides;
    if (changed) {
      state.dice.values = Array.from({ length: count }, () => randomInt(sides) + 1);
      saveState();
      renderDice(true);
      setMotionCopy('設定已更新', '搖動手機，才會換出下一組數字。');
      if (diceSync.mode === 'host') {
        diceSync.players.forEach((player, index) => {
          player.values = index === 0
            ? [...state.dice.values]
            : Array.from({ length: count }, () => randomInt(sides) + 1);
          player.lastAt = Date.now();
        });
        renderDiceTable();
        broadcastDiceState();
        showToast('房間設定已更新，已幫大家重骰');
      }
    } else {
      updateDiceStatus();
    }
  }

  function adjustDiceSetting(input, amount) {
    const limit = input === diceCountInput ? [1, 12] : [2, 100];
    input.value = clamp((Number(input.value) || limit[0]) + amount, limit[0], limit[1]);
    applyDiceSettings();
  }

  $('#diceCountDown').addEventListener('click', () => adjustDiceSetting(diceCountInput, -1));
  $('#diceCountUp').addEventListener('click', () => adjustDiceSetting(diceCountInput, 1));
  $('#diceSidesDown').addEventListener('click', () => adjustDiceSetting(diceSidesInput, -1));
  $('#diceSidesUp').addEventListener('click', () => adjustDiceSetting(diceSidesInput, 1));
  diceCountInput.addEventListener('change', applyDiceSettings);
  diceSidesInput.addEventListener('change', applyDiceSettings);
  $$('.preset-button').forEach((button) => {
    button.addEventListener('click', () => {
      diceSidesInput.value = button.dataset.sides;
      applyDiceSettings();
    });
  });

  function revealDice() {
    diceStage.classList.add('is-revealed');
  }

  function hideDice() {
    if (diceSync.mode !== 'local' && diceSync.privacy === 'public') return;
    diceStage.classList.remove('is-revealed');
  }

  diceStage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    revealDice();
    if (diceStage.setPointerCapture) diceStage.setPointerCapture(event.pointerId);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => diceStage.addEventListener(eventName, hideDice));
  diceStage.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      revealDice();
    }
  });
  diceStage.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      hideDice();
    }
  });
  window.addEventListener('blur', hideDice);

  function handleMotion(event) {
    if (!motionActive) return;
    const acceleration = event.acceleration || event.accelerationIncludingGravity;
    if (!acceleration) return;
    const current = {
      x: Number(acceleration.x) || 0,
      y: Number(acceleration.y) || 0,
      z: Number(acceleration.z) || 0,
    };
    if (!lastMotion) {
      lastMotion = current;
      return;
    }
    const delta = Math.abs(current.x - lastMotion.x) + Math.abs(current.y - lastMotion.y) + Math.abs(current.z - lastMotion.z);
    const magnitude = Math.sqrt(current.x ** 2 + current.y ** 2 + current.z ** 2);
    lastMotion = current;
    const now = Date.now();
    if ((delta > 14 || magnitude > 22) && now - lastShakeAt > 850) {
      lastShakeAt = now;
      rerollDice('shake');
    }
  }

  function startMotionListening() {
    if (motionListenerAttached) return;
    window.addEventListener('devicemotion', handleMotion, { passive: true });
    motionListenerAttached = true;
    motionActive = true;
    lastMotion = null;
    $('#enableMotionButton').textContent = '搖一搖已開啟';
    setMotionCopy('可以搖了！', '搖動手機換骰，按住骰面偷看結果。');
    showToast('搖一搖已開啟');
  }

  async function enableMotion() {
    if (typeof DeviceMotionEvent === 'undefined') {
      setMotionCopy('此裝置沒有動作感應器', '請使用「模擬搖動」體驗換骰。');
      showToast('這部裝置不支援動作感應');
      return;
    }
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          setMotionCopy('需要動作感應權限', '請在瀏覽器設定允許動作感應，才可搖動換骰。');
          showToast('尚未允許動作感應');
          return;
        }
      }
      startMotionListening();
    } catch (error) {
      setMotionCopy('無法啟用動作感應', '你仍可使用「模擬搖動」測試骰子。');
      showToast('動作感應啟用失敗');
    }
  }

  $('#enableMotionButton').addEventListener('click', enableMotion);
  $('#simulateShakeButton').addEventListener('click', () => {
    rerollDice('shake');
    showToast(diceSync.mode !== 'local' ? '已擲骰 · 同步給大家' : '模擬搖動 · 骰子已換面');
  });

  // Lucky wheel
  const wheelCanvas = $('#wheelCanvas');
  const wheelOptionsList = $('#wheelOptionsList');
  const wheelResult = $('#wheelResult');

  function renderWheelOptions() {
    wheelOptionsList.replaceChildren();
    state.wheel.options.forEach((option, index) => {
      const item = document.createElement('li');
      item.className = 'wheel-option';
      const color = document.createElement('span');
      color.className = 'option-color';
      color.style.color = WHEEL_COLORS[index % WHEEL_COLORS.length];
      color.style.backgroundColor = WHEEL_COLORS[index % WHEEL_COLORS.length];
      color.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = option;
      const remove = document.createElement('button');
      remove.className = 'remove-option';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `刪除選項 ${option}`);
      remove.disabled = state.wheel.options.length <= 2;
      remove.addEventListener('click', () => {
        if (state.wheel.options.length <= 2) return;
        state.wheel.options.splice(index, 1);
        wheelRotation = 0;
        saveState();
        renderWheelOptions();
        drawWheel();
      });
      item.append(color, text, remove);
      wheelOptionsList.appendChild(item);
    });
    $('#wheelCount').textContent = pad(state.wheel.options.length);
    $('#wheelEditorCount').textContent = `${state.wheel.options.length} / ${MAX_WHEEL_OPTIONS}`;
  }

  function drawWheel() {
    if (!wheelCanvas) return;
    const rect = wheelCanvas.getBoundingClientRect();
    const size = Math.max(280, rect.width || 360);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(size * pixelRatio);
    if (wheelCanvas.width !== width || wheelCanvas.height !== width) {
      wheelCanvas.width = width;
      wheelCanvas.height = width;
    }
    const context = wheelCanvas.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size, size);

    const center = size / 2;
    const radius = size / 2 - 18;
    const options = state.wheel.options;
    const arc = TAU / options.length;
    context.save();
    context.translate(center, center);
    context.rotate(wheelRotation);
    context.translate(-center, -center);

    options.forEach((option, index) => {
      const start = -Math.PI / 2 + index * arc;
      const end = start + arc;
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, radius, start, end);
      context.closePath();
      context.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
      context.fill();
      context.lineWidth = Math.max(1.4, size / 190);
      context.strokeStyle = 'rgba(10, 11, 15, 0.38)';
      context.stroke();
    });
    context.restore();

    // Labels are drawn separately so they remain crisp and follow the wheel rotation.
    const fontSize = clamp(size / (options.length > 9 ? 31 : 25), 10, 16);
    options.forEach((option, index) => {
      const angle = -Math.PI / 2 + (index + 0.5) * arc + wheelRotation;
      const label = option.length > (options.length > 9 ? 7 : 10) ? `${option.slice(0, options.length > 9 ? 6 : 9)}…` : option;
      context.save();
      context.translate(center, center);
      context.rotate(angle);
      context.translate(radius * 0.62, 0);
      if (Math.cos(angle) < 0) context.rotate(Math.PI);
      context.fillStyle = 'rgba(11, 12, 16, 0.86)';
      context.font = `800 ${fontSize}px ui-rounded, "PingFang TC", "Noto Sans TC", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, 0, 0, radius * 0.66);
      context.restore();
    });

    // A small highlight at the rim makes the canvas feel like a physical wheel.
    context.beginPath();
    context.arc(center, center, radius, 0, TAU);
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    context.stroke();
  }

  function addWheelOption() {
    const input = $('#newWheelOption');
    const option = input.value.trim();
    if (!option) {
      input.focus();
      showToast('先輸入一個輪盤選項');
      return;
    }
    if (state.wheel.options.length >= MAX_WHEEL_OPTIONS) {
      showToast(`最多放 ${MAX_WHEEL_OPTIONS} 個選項`);
      return;
    }
    state.wheel.options.push(option);
    input.value = '';
    wheelRotation = 0;
    saveState();
    renderWheelOptions();
    drawWheel();
    input.focus();
  }

  $('#addWheelOptionButton').addEventListener('click', addWheelOption);
  $('#newWheelOption').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addWheelOption();
    }
  });

  $$('.chip-button').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = WHEEL_PRESETS[button.dataset.wheelPreset];
      if (!preset) return;
      state.wheel.options = [...preset];
      wheelRotation = 0;
      wheelResult.classList.remove('has-result');
      $('.result-label', wheelResult).textContent = '準備好了嗎？';
      $('strong', wheelResult).textContent = '轉一下看看';
      saveState();
      renderWheelOptions();
      drawWheel();
      showToast(`已套用「${button.textContent}」範本`);
    });
  });

  function spinWheel() {
    if (wheelSpinning || state.wheel.options.length < 2) return;
    wheelSpinning = true;
    const button = $('#spinWheelButton');
    button.disabled = true;
    wheelResult.classList.remove('has-result');
    $('.result-label', wheelResult).textContent = '正在旋轉…';
    $('strong', wheelResult).textContent = '命運決定中';

    const chosenIndex = randomInt(state.wheel.options.length);
    const arc = TAU / state.wheel.options.length;
    const target = -((chosenIndex + 0.5) * arc);
    const delta = mod(target - mod(wheelRotation, TAU), TAU);
    const startRotation = wheelRotation;
    const endRotation = wheelRotation + TAU * 5 + delta;
    const duration = 3600;
    const startedAt = performance.now();

    const animate = (now) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - ((1 - progress) ** 4);
      wheelRotation = startRotation + (endRotation - startRotation) * eased;
      drawWheel();
      if (progress < 1) {
        window.requestAnimationFrame(animate);
        return;
      }
      wheelRotation = endRotation;
      drawWheel();
      wheelSpinning = false;
      button.disabled = false;
      wheelResult.classList.add('has-result');
      $('.result-label', wheelResult).textContent = '這次是';
      $('strong', wheelResult).textContent = state.wheel.options[chosenIndex];
      vibrate([20, 35, 70]);
    };
    window.requestAnimationFrame(animate);
  }

  $('#spinWheelButton').addEventListener('click', spinWheel);
  window.addEventListener('resize', drawWheel);

  // Team shuffle
  const teamPlayerCountInput = $('#teamPlayerCount');
  const teamCountInput = $('#teamCount');
  const participantNames = $('#participantNames');
  const teamResult = $('#teamResult');

  function getTeamNames() {
    return Array.from({ length: state.teamShuffle.peopleCount }, (_, index) => {
      const input = $(`[data-participant-index="${index}"]`, participantNames);
      return input ? input.value.trim() : (state.teamShuffle.names[index] || '').trim();
    });
  }

  function renderTeamResult(teams = state.teamShuffle.lastTeams) {
    teamResult.replaceChildren();
    if (!Array.isArray(teams) || !teams.length) {
      const hint = document.createElement('span');
      hint.textContent = '填好名字就可以開始';
      teamResult.appendChild(hint);
      return;
    }
    teamResult.classList.remove('has-teams');
    void teamResult.offsetWidth;
    teamResult.classList.add('has-teams');
    teams.forEach((team, index) => {
      const card = document.createElement('div');
      card.className = 'team-result-card';
      const heading = document.createElement('div');
      heading.className = 'team-result-heading';
      const title = document.createElement('strong');
      title.textContent = `第 ${index + 1} 隊`;
      const count = document.createElement('span');
      count.textContent = `${team.length} 人`;
      heading.append(title, count);
      const members = document.createElement('p');
      members.textContent = team.join(' · ');
      card.append(heading, members);
      teamResult.appendChild(card);
    });
  }

  function renderParticipantInputs() {
    const count = clamp(Math.floor(Number(state.teamShuffle.peopleCount) || 4), 2, 24);
    state.teamShuffle.peopleCount = count;
    state.teamShuffle.names = Array.from({ length: count }, (_, index) => {
      const name = typeof state.teamShuffle.names[index] === 'string' ? state.teamShuffle.names[index].trim() : '';
      return name || `玩家 ${index + 1}`;
    });
    teamPlayerCountInput.value = count;
    teamCountInput.value = state.teamShuffle.teamCount;
    $('#teamNameCount').textContent = `${count} 人`;
    participantNames.replaceChildren();

    state.teamShuffle.names.forEach((name, index) => {
      const row = document.createElement('label');
      row.className = 'participant-input-row';
      const number = document.createElement('span');
      number.className = 'participant-number';
      number.textContent = pad(index + 1);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.value = name;
      input.placeholder = `第 ${index + 1} 位名字`;
      input.dataset.participantIndex = String(index);
      input.setAttribute('aria-label', `第 ${index + 1} 位參加者名字`);
      input.addEventListener('input', () => {
        state.teamShuffle.names[index] = input.value;
        saveState();
      });
      row.append(number, input);
      participantNames.appendChild(row);
    });
  }

  function syncTeamSetup() {
    const peopleCount = clamp(Math.floor(Number(teamPlayerCountInput.value) || state.teamShuffle.peopleCount), 2, 24);
    const teamCount = clamp(Math.floor(Number(teamCountInput.value) || state.teamShuffle.teamCount), 2, Math.min(8, peopleCount));
    state.teamShuffle.peopleCount = peopleCount;
    state.teamShuffle.teamCount = teamCount;
    teamPlayerCountInput.value = peopleCount;
    teamCountInput.value = teamCount;
    renderParticipantInputs();
    state.teamShuffle.lastTeams = [];
    renderTeamResult([]);
    saveState();
  }

  teamPlayerCountInput.addEventListener('change', syncTeamSetup);
  teamCountInput.addEventListener('change', syncTeamSetup);
  $('#splitTeamsButton').addEventListener('click', () => {
    const names = getTeamNames().map((name, index) => name || `玩家 ${index + 1}`);
    state.teamShuffle.names = names;
    const shuffled = [...names];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    const teams = Array.from({ length: state.teamShuffle.teamCount }, () => []);
    shuffled.forEach((name, index) => teams[index % state.teamShuffle.teamCount].push(name));
    state.teamShuffle.lastTeams = teams;
    saveState();
    renderTeamResult(teams);
    $('#teamSplitStatus').textContent = `${state.teamShuffle.teamCount} 隊 · 已打散`;
    showToast('分隊完成，人數已盡量平均');
    vibrate([20, 30, 45]);
  });
  renderParticipantInputs();
  renderTeamResult();

  // Coin
  $('#flipCoinButton').addEventListener('click', () => {
    if (coinBusy) return;
    coinBusy = true;
    const button = $('#flipCoinButton');
    const coin = $('#coin');
    const result = Math.random() < 0.5 ? '正面' : '反面';
    button.disabled = true;
    coin.classList.remove('is-flipping');
    void coin.offsetWidth;
    coin.classList.add('is-flipping');
    $('#coinResult').textContent = '…';
    window.setTimeout(() => {
      coin.classList.remove('is-flipping');
      coin.classList.toggle('show-back', result === '反面');
      $('#coinResult').textContent = result;
      button.disabled = false;
      coinBusy = false;
      vibrate(35);
    }, 760);
  });

  // Multi-player scoreboard
  const scoreEntryCountInput = $('#scoreEntryCount');
  const scoreEntriesList = $('#scoreEntriesList');
  const scoreSummary = $('#scoreSummary');

  function renderScore() {
    const count = clamp(Math.floor(Number(state.score.count) || state.score.entries.length || 4), 2, 12);
    state.score.count = count;
    state.score.entries = Array.from({ length: count }, (_, index) => {
      const entry = state.score.entries[index] || {};
      return {
        name: validString(entry.name, `玩家 ${index + 1}`).slice(0, 14) || `玩家 ${index + 1}`,
        score: clamp(Math.floor(Number(entry.score) || 0), -999999, 999999),
        round: clamp(Math.floor(Number(entry.round) || 0), 0, 999999),
      };
    });
    scoreEntryCountInput.value = count;
    scoreEntriesList.replaceChildren();

    state.score.entries.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      const number = document.createElement('span');
      number.className = 'score-row-number';
      number.textContent = pad(index + 1);
      const name = document.createElement('input');
      name.className = 'score-name-input';
      name.type = 'text';
      name.maxLength = 14;
      name.value = entry.name;
      name.setAttribute('aria-label', `第 ${index + 1} 個玩家或隊伍名稱`);
      name.addEventListener('input', () => {
        state.score.entries[index].name = name.value.slice(0, 14);
        saveState();
      });
      const value = document.createElement('strong');
      value.className = 'score-row-value';
      value.textContent = String(entry.score);
      const roundInput = document.createElement('input');
      roundInput.className = 'score-round-input';
      roundInput.type = 'number';
      roundInput.min = '0';
      roundInput.max = '999999';
      roundInput.placeholder = '本局';
      roundInput.inputMode = 'numeric';
      roundInput.value = entry.round ? String(entry.round) : '';
      roundInput.setAttribute('aria-label', `${entry.name} 本局分數`);
      roundInput.addEventListener('input', () => {
        state.score.entries[index].round = clamp(Math.floor(Number(roundInput.value) || 0), 0, 999999);
        saveState();
      });
      const minus = document.createElement('button');
      minus.className = 'score-change-button';
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `${entry.name} 扣除本局分數`);
      minus.addEventListener('click', () => changeScore(index, -1));
      const plus = document.createElement('button');
      plus.className = 'score-change-button score-plus';
      plus.type = 'button';
      plus.textContent = '＋';
      plus.setAttribute('aria-label', `${entry.name} 加上本局分數`);
      plus.addEventListener('click', () => changeScore(index, 1));
      row.append(number, name, value, roundInput, minus, plus);
      scoreEntriesList.appendChild(row);
    });

    const total = state.score.entries.reduce((sum, entry) => sum + entry.score, 0);
    $('#scoreTotalLabel').textContent = `總分 ${total}`;
    scoreSummary.textContent = `已記錄 ${state.score.entries.length} 位 · 合計 ${total} 分`;
  }

  function changeScore(index, direction) {
    const entry = state.score.entries[index];
    const points = clamp(Math.floor(Number(entry.round) || 0), 0, 999999);
    if (!points) {
      showToast('先輸入這一行的本局分數');
      return;
    }
    entry.score = clamp(entry.score + (points * direction), -999999, 999999);
    entry.round = 0;
    saveState();
    renderScore();
    vibrate(18);
  }

  function syncScoreEntryCount() {
    const count = clamp(Math.floor(Number(scoreEntryCountInput.value) || state.score.count), 2, 12);
    state.score.count = count;
    state.score.entries = Array.from({ length: count }, (_, index) => state.score.entries[index] || ({ name: `玩家 ${index + 1}`, score: 0, round: 0 }));
    scoreEntryCountInput.value = count;
    saveState();
    renderScore();
  }

  scoreEntryCountInput.addEventListener('change', syncScoreEntryCount);
  $('#resetScoreButton').addEventListener('click', () => {
    state.score.entries.forEach((entry) => { entry.score = 0; entry.round = 0; });
    saveState();
    renderScore();
    showToast('所有分數已歸零');
  });
  renderScore();

  // Multi-device scoreboard (host + clients via PeerJS, with QR codes)
  const PEER_HOST_PREFIX = 'pocket-play-';
  const scoreSync = {
    mode: 'local',      // 'local' | 'host' | 'client'
    code: '',
    peer: null,
    conns: [],          // host: [{ conn, slot }]
    conn: null,         // client: single connection
    mySlot: 0,
    draftRound: '',
    ready: false,
  };
  const scoreOffline = $('#scoreOffline');
  const scoreSyncPanel = $('#scoreSync');
  const syncBadge = $('#syncBadge');
  const syncIdle = $('#syncIdle');
  const syncStatus = $('#syncStatus');
  const qrGrid = $('#qrGrid');
  const syncLive = $('#syncLive');
  const syncMy = $('#syncMy');
  const syncBoard = $('#syncBoard');
  const syncFootnote = $('#syncFootnote');
  const endRoomButton = $('#endRoomButton');

  function makeRoomCode(length = 6) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let index = 0; index < length; index += 1) result += chars[randomInt(chars.length)];
    return result;
  }

  function makeClientId(code, slot) {
    return `${PEER_HOST_PREFIX}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function setScoreMode(mode) {
    scoreSync.mode = mode;
    const connected = mode !== 'local';
    scoreOffline.hidden = connected;
    scoreSyncPanel.hidden = false;
    syncIdle.hidden = connected;
    endRoomButton.hidden = !connected;
    syncFootnote.hidden = !connected;
    syncBadge.textContent = mode === 'host' ? '房主' : mode === 'client' ? '已連線' : '本機';
    if (!connected) {
      syncStatus.hidden = true;
      qrGrid.hidden = true;
      syncLive.hidden = true;
    } else {
      syncStatus.hidden = false;
      syncLive.hidden = false;
      if (mode === 'client') qrGrid.hidden = true;
    }
  }

  function updateSyncStatus(text) {
    syncStatus.textContent = text;
    syncStatus.hidden = false;
  }

  function renderSyncMy() {
    const fallback = { name: `玩家 ${scoreSync.mySlot + 1}`, score: 0 };
    const me = state.score.entries[scoreSync.mySlot] || fallback;
    syncMy.replaceChildren();

    const row = document.createElement('div');
    row.className = 'sync-my-row';
    const label = document.createElement('span');
    label.className = 'sync-my-label';
    label.textContent = `我是 · 玩家 ${scoreSync.mySlot + 1}`;
    const name = document.createElement('input');
    name.className = 'sync-my-name';
    name.type = 'text';
    name.maxLength = 14;
    name.value = me.name;
    name.setAttribute('aria-label', '我的名字');
    name.addEventListener('change', () => {
      const value = name.value.trim().slice(0, 14) || `玩家 ${scoreSync.mySlot + 1}`;
      state.score.entries[scoreSync.mySlot].name = value;
      if (scoreSync.mode === 'client') sendToHost({ type: 'name', slot: scoreSync.mySlot, name: value });
      else { saveState(); broadcastState(); }
    });
    const myScore = document.createElement('strong');
    myScore.className = 'sync-my-score';
    myScore.textContent = String(me.score);
    row.append(label, name, myScore);
    syncMy.appendChild(row);

    const controls = document.createElement('div');
    controls.className = 'sync-my-controls';
    const round = document.createElement('input');
    round.className = 'sync-my-round';
    round.type = 'number';
    round.min = '0';
    round.max = '999999';
    round.inputMode = 'numeric';
    round.placeholder = '本局分數';
    round.value = scoreSync.draftRound;
    round.setAttribute('aria-label', '本局分數');
    round.addEventListener('input', () => { scoreSync.draftRound = round.value; });
    const minus = document.createElement('button');
    minus.className = 'button score-change-button score-minus';
    minus.type = 'button';
    minus.textContent = '− 扣分';
    minus.addEventListener('click', () => submitMyScore(-1));
    const plus = document.createElement('button');
    plus.className = 'button score-change-button score-plus';
    plus.type = 'button';
    plus.textContent = '＋ 記分';
    plus.addEventListener('click', () => submitMyScore(1));
    controls.append(round, minus, plus);
    syncMy.appendChild(controls);
  }

  function renderSyncBoard() {
    syncBoard.replaceChildren();
    const list = document.createElement('div');
    list.className = 'sync-board-list';
    state.score.entries.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'sync-board-item' + (index === scoreSync.mySlot ? ' is-me' : '');
      const rank = document.createElement('span');
      rank.className = 'sync-board-rank';
      rank.textContent = String(index + 1);
      const nm = document.createElement('strong');
      nm.className = 'sync-board-name';
      nm.textContent = entry.name;
      const sc = document.createElement('span');
      sc.className = 'sync-board-score';
      sc.textContent = String(entry.score);
      item.append(rank, nm, sc);
      list.appendChild(item);
    });
    syncBoard.appendChild(list);
  }

  function renderSyncLive() {
    renderSyncMy();
    renderSyncBoard();
  }

  function submitMyScore(direction) {
    const round = clamp(Math.floor(Number(scoreSync.draftRound) || 0), 0, 999999);
    if (!round) {
      showToast('先輸入本局分數');
      const input = $('.sync-my-round', syncMy);
      if (input) input.focus();
      return;
    }
    const slot = scoreSync.mySlot;
    if (scoreSync.mode === 'client') {
      sendToHost({ type: 'apply', slot, round, direction });
    } else if (scoreSync.mode === 'host') {
      const entry = state.score.entries[slot];
      if (entry) {
        entry.score = clamp(entry.score + (round * direction), -999999, 999999);
        entry.round = 0;
        saveState();
        renderSyncLive();
        broadcastState();
      }
    }
    scoreSync.draftRound = '';
    renderSyncMy();
    vibrate(18);
  }

  function broadcastState() {
    const payload = {
      type: 'state',
      entries: state.score.entries.map((entry) => ({ name: entry.name, score: entry.score, round: entry.round })),
      count: state.score.count,
    };
    scoreSync.conns.forEach(({ conn }) => {
      try { conn.send(payload); } catch (error) { /* ignore */ }
    });
    renderSyncLive();
  }

  function sendToHost(message) {
    if (scoreSync.conn && scoreSync.conn.open) {
      try { scoreSync.conn.send(message); } catch (error) { /* ignore */ }
    } else {
      showToast('尚未連上房主');
    }
  }

  function buildQrCard(slot, url, subLabel) {
    const card = document.createElement('div');
    card.className = 'qr-card';
    const label = document.createElement('strong');
    label.textContent = `玩家 ${slot + 1}`;
    const sub = document.createElement('span');
    sub.className = 'qr-card-sub';
    sub.textContent = subLabel || `掃描後以「玩家 ${slot + 1}」加入`;
    const box = document.createElement('div');
    box.className = 'qr-box';
    if (typeof qrcode === 'function') {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        box.innerHTML = qr.createImgTag(6, 4);
        const img = box.querySelector('img');
        if (img) { img.width = ''; img.height = ''; img.removeAttribute('width'); img.removeAttribute('height'); }
      } catch (error) {
        box.textContent = 'QR 產生失敗';
      }
    } else {
      box.textContent = 'QR 程式未載入';
    }
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'qr-link';
    link.textContent = '開啟加入頁面';
    card.append(label, sub, box, link);
    return card;
  }

  function renderQrGrid() {
    qrGrid.replaceChildren();
    if (typeof qrcode !== 'function') {
      qrGrid.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const count = state.score.count;
    for (let slot = 1; slot < count; slot += 1) {
      const url = `${base}?${new URLSearchParams({ join: scoreSync.code, p: String(slot) }).toString()}`;
      qrGrid.appendChild(buildQrCard(slot, url));
    }
    qrGrid.hidden = false;
  }

  function setupHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { handleHostMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => removeHostConn(conn));
    conn.on('error', () => removeHostConn(conn));
  }

  function hostConnectionCount() {
    return scoreSync.conns.length + 1;
  }

  function handleHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, state.score.count - 1);
      conn.slot = slot;
      const name = validString(message.name, '').trim().slice(0, 14);
      if (state.score.entries[slot] && name) state.score.entries[slot].name = name;
      if (!scoreSync.conns.some((entry) => entry.conn === conn)) scoreSync.conns.push({ conn, slot });
      saveState();
      updateSyncStatus(`房間代號 ${scoreSync.code} · 已連線 ${hostConnectionCount()}/${state.score.count} 人`);
      renderSyncLive();
      broadcastState();
    } else if (message.type === 'apply') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, state.score.count - 1);
      const entry = state.score.entries[slot];
      const round = clamp(Math.floor(Number(message.round) || 0), 0, 999999);
      const direction = Number(message.direction) >= 0 ? 1 : -1;
      if (entry && round) {
        entry.score = clamp(entry.score + (round * direction), -999999, 999999);
        entry.round = 0;
        saveState();
        renderSyncLive();
        broadcastState();
      }
    } else if (message.type === 'name') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, state.score.count - 1);
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${slot + 1}`;
      if (state.score.entries[slot]) {
        state.score.entries[slot].name = name;
        saveState();
        renderSyncLive();
        broadcastState();
      }
    }
  }

  function removeHostConn(conn) {
    const before = scoreSync.conns.length;
    scoreSync.conns = scoreSync.conns.filter((entry) => entry.conn !== conn);
    if (scoreSync.conns.length !== before) {
      updateSyncStatus(`房間代號 ${scoreSync.code} · 已連線 ${hostConnectionCount()}/${state.score.count} 人`);
    }
  }

  function resetSync() {
    try { if (scoreSync.peer) scoreSync.peer.destroy(); } catch (error) { /* ignore */ }
    scoreSync.mode = 'local';
    scoreSync.code = '';
    scoreSync.peer = null;
    scoreSync.conns = [];
    scoreSync.conn = null;
    scoreSync.mySlot = 0;
    scoreSync.draftRound = '';
    scoreSync.ready = false;
    setScoreMode('local');
    renderScore();
  }

  function createRoom() {
    if (scoreSync.mode !== 'local') return;
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    const code = makeRoomCode();
    scoreSync.code = code;
    scoreSync.mySlot = 0;
    scoreSync.conns = [];
    setScoreMode('host');
    updateSyncStatus('建立中…');
    peerCreate(`${PEER_HOST_PREFIX}${code.toLowerCase()}`);
  }

  function peerCreate(hostId) {
    const peer = new Peer(hostId, { debug: 1 });
    scoreSync.peer = peer;
    peer.on('open', () => {
      scoreSync.ready = true;
      updateSyncStatus(`房間代號 ${scoreSync.code} · 等大家掃 QR 加入`);
      renderSyncLive();
      renderQrGrid();
    });
    peer.on('connection', (conn) => setupHostConnection(conn));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突，請重試'); resetSync(); }
      else if (type === 'invalid-id') { showToast('連線設定錯誤'); resetSync(); }
      else showToast('連線暫時不穩，仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function joinRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      setScoreMode('local');
      return;
    }
    scoreSync.code = code;
    scoreSync.mySlot = slot;
    scoreSync.conns = [];
    scoreSync.draftRound = '';
    setScoreMode('client');
    updateSyncStatus(`正在連線「${code}」…`);
    const peer = new Peer(makeClientId(code, slot), { debug: 1 });
    scoreSync.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${PEER_HOST_PREFIX}${code.toLowerCase()}`, { reliable: true });
      scoreSync.conn = conn;
      conn.on('open', () => {
        const existing = state.score.entries[slot];
        const name = (existing && validString(existing.name, '').trim()) || `玩家 ${slot + 1}`;
        conn.send({ type: 'hello', slot, name });
      });
      conn.on('data', (message) => { try { handleClientMessage(message); } catch (error) { /* ignore */ } });
      conn.on('close', () => updateSyncStatus('已中斷連線，請重新掃描 QR'));
      conn.on('error', () => updateSyncStatus('連線中斷，請重新掃描 QR'));
    });
    peer.on('error', () => {
      showToast('連線失敗，請確認網路');
      updateSyncStatus('連線失敗，請確認網路後重新掃描');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function handleClientMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state' && Array.isArray(message.entries)) {
      state.score.count = clamp(Math.floor(Number(message.count) || message.entries.length || state.score.count), 2, 12);
      state.score.entries = Array.from({ length: state.score.count }, (_, index) => {
        const entry = message.entries[index] && typeof message.entries[index] === 'object' ? message.entries[index] : {};
        return {
          name: validString(entry.name, `玩家 ${index + 1}`).trim().slice(0, 14) || `玩家 ${index + 1}`,
          score: clamp(Math.floor(Number(entry.score) || 0), -999999, 999999),
          round: clamp(Math.floor(Number(entry.round) || 0), 0, 999999),
        };
      });
      saveState();
      scoreSync.ready = true;
      updateSyncStatus(`已連線 · 玩家 ${scoreSync.mySlot + 1}`);
      renderSyncLive();
    }
  }

  function initSyncFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const wolfCode = (params.get('wolf') || '').trim();
    const diceCode = (params.get('dice') || '').trim();
    const joinCode = (params.get('join') || '').trim();
    const spyCode = (params.get('spy') || '').trim();
    const oneCode = (params.get('one') || '').trim();
    const agentCode = (params.get('agent') || '').trim();
    const texasCode = (params.get('tx') || '').trim();
    const bjCode = (params.get('bj') || '').trim();
    const bacCode = (params.get('bac') || '').trim();
    const slot = Number(params.get('p'));
    if (texasCode && Number.isFinite(slot) && slot >= 1) {
      switchView('texas');
      joinTexasRoom(texasCode.toUpperCase(), clamp(Math.floor(slot), 1, 8));
    } else if (bjCode && Number.isFinite(slot) && slot >= 1) {
      switchView('bj');
      joinBlackjackRoom(bjCode.toUpperCase(), clamp(Math.floor(slot), 1, 8));
    } else if (bacCode && Number.isFinite(slot) && slot >= 1) {
      switchView('bac');
      joinBaccaratRoom(bacCode.toUpperCase(), clamp(Math.floor(slot), 1, 8));
    } else if (wolfCode && Number.isFinite(slot) && slot >= 1) {
      switchView('wolf');
      joinWolfRoom(wolfCode.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    } else if (spyCode && Number.isFinite(slot) && slot >= 1) {
      switchView('spy');
      joinSpyRoom(spyCode.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    } else if (oneCode && Number.isFinite(slot) && slot >= 1) {
      switchView('one');
      joinOneNightRoom(oneCode.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    } else if (agentCode && Number.isFinite(slot) && slot >= 1) {
      switchView('agent');
      joinAgentRoom(agentCode.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    } else if (diceCode && Number.isFinite(slot) && slot >= 1) {
      switchView('dice');
      joinDiceRoom(diceCode.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    } else if (joinCode && Number.isFinite(slot) && slot >= 1) {
      switchView('tools');
      joinRoom(joinCode.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    }
  }

  $('#createRoomButton').addEventListener('click', createRoom);
  endRoomButton.addEventListener('click', () => {
    resetSync();
    showToast('已結束連線');
  });

  // Multi-device dice room (host + clients via PeerJS, with QR codes)
  const DICE_HOST_PREFIX = 'pocket-dice-';
  const diceSync = {
    mode: 'local',      // 'local' | 'host' | 'client'
    code: '',
    peer: null,
    conns: [],          // host: [{ conn, slot }]
    conn: null,         // client: single connection
    mySlot: 0,
    ready: false,
    privacy: 'public',  // 'public' | 'hidden' (host-controlled)
    players: [],        // [{ name, values, online, lastAt }]
  };
  const diceControls = $('#diceControls');
  const roomSettingsNote = $('#roomSettingsNote');
  const diceSyncBadge = $('#diceSyncBadge');
  const diceSyncIdle = $('#diceSyncIdle');
  const diceSyncStatus = $('#diceSyncStatus');
  const diceQrGrid = $('#diceQrGrid');
  const diceLive = $('#diceLive');
  const diceRoomBar = $('#diceRoomBar');
  const diceTable = $('#diceTable');
  const diceSyncFootnote = $('#diceSyncFootnote');
  const endDiceRoomButton = $('#endDiceRoomButton');
  const diceRoomPlayersInput = $('#diceRoomPlayers');

  function dicePlayerCount() {
    return clamp(Math.floor(Number(diceRoomPlayersInput.value) || 4), 2, 12);
  }

  function makeDiceClientId(code, slot) {
    return `${DICE_HOST_PREFIX}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function updateDiceSyncStatus(text) {
    diceSyncStatus.textContent = text;
    diceSyncStatus.hidden = false;
  }

  function setDiceMode(mode) {
    diceSync.mode = mode;
    const connected = mode !== 'local';
    diceSyncIdle.hidden = connected;
    endDiceRoomButton.hidden = !connected;
    diceSyncFootnote.hidden = !connected;
    diceRoomBar.hidden = mode !== 'host';
    diceSyncBadge.textContent = mode === 'host' ? '房主' : mode === 'client' ? '已連線' : '本機';
    if (!connected) {
      diceSyncStatus.hidden = true;
      diceQrGrid.hidden = true;
      diceLive.hidden = true;
    } else {
      diceSyncStatus.hidden = false;
      diceLive.hidden = false;
      if (mode === 'client') diceQrGrid.hidden = true;
    }
    if (mode === 'client') {
      diceControls.hidden = true;
      roomSettingsNote.hidden = false;
    } else {
      diceControls.hidden = false;
      roomSettingsNote.hidden = true;
    }
    const simButton = $('#simulateShakeButton');
    simButton.textContent = connected ? '擲骰' : '模擬搖動';
    applyDicePrivacy();
  }

  function syncDicePrivacyButtons() {
    $$('[data-dice-privacy]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.dicePrivacy === diceSync.privacy);
    });
  }

  function applyDicePrivacy() {
    syncDicePrivacyButtons();
    const hint = $('#diceInstructionText');
    if (diceSync.mode !== 'local' && diceSync.privacy === 'public') {
      diceStage.classList.add('is-revealed');
      if (hint) hint.textContent = '骰面公開 · 搖動換骰';
    } else {
      diceStage.classList.remove('is-revealed');
      if (hint) hint.textContent = '按住查看結果';
    }
    renderDiceTable();
  }

  function renderDiceTable() {
    if (!diceTable) return;
    diceTable.replaceChildren();
    const inRoom = diceSync.mode !== 'local';
    const isPublic = inRoom && diceSync.privacy === 'public';
    diceSync.players.forEach((player, index) => {
      const isMe = inRoom && index === diceSync.mySlot;
      const row = document.createElement('div');
      row.className = 'dice-table-row'
        + (isMe ? ' is-me' : '')
        + (player.online === false ? ' is-offline' : '');
      const meta = document.createElement('div');
      meta.className = 'dice-table-meta';
      const rank = document.createElement('span');
      rank.className = 'dice-table-rank';
      rank.textContent = pad(index + 1);
      let nameEl;
      if (isMe) {
        nameEl = document.createElement('input');
        nameEl.className = 'dice-table-name-input';
        nameEl.type = 'text';
        nameEl.maxLength = 14;
        nameEl.value = player.name;
        nameEl.setAttribute('aria-label', '我的名字');
        nameEl.addEventListener('change', () => {
          const value = nameEl.value.trim().slice(0, 14) || `玩家 ${index + 1}`;
          diceSync.players[index].name = value;
          if (diceSync.mode === 'client') sendToDiceHost({ type: 'name', slot: index, name: value });
          else broadcastDiceState();
        });
      } else {
        nameEl = document.createElement('strong');
        nameEl.className = 'dice-table-name';
        nameEl.textContent = player.name;
        if (player.online === false) {
          const offline = document.createElement('span');
          offline.className = 'dice-table-offline';
          offline.textContent = '離線';
          nameEl.appendChild(offline);
        }
      }
      const sum = document.createElement('span');
      sum.className = 'dice-table-sum';
      const total = player.values.reduce((acc, value) => acc + (Number(value) || 0), 0);
      sum.textContent = `總和 ${total}`;
      meta.append(rank, nameEl, sum);
      const diceWrap = document.createElement('div');
      diceWrap.className = 'dice-table-dice';
      player.values.forEach((value) => {
        if (isPublic) {
          diceWrap.appendChild(buildDie(value, state.dice.sides, true));
        } else {
          const hiddenDie = document.createElement('div');
          hiddenDie.className = 'die die-small die-hidden';
          hiddenDie.textContent = '?';
          hiddenDie.setAttribute('aria-label', '蓋住的骰子');
          diceWrap.appendChild(hiddenDie);
        }
      });
      row.append(meta, diceWrap);
      diceTable.appendChild(row);
    });
  }

  function broadcastDiceState() {
    const payload = {
      type: 'state',
      players: diceSync.players.map((player) => ({
        name: player.name,
        values: player.values,
        online: player.online !== false,
      })),
      settings: { count: state.dice.count, sides: state.dice.sides },
      privacy: diceSync.privacy,
    };
    diceSync.conns.forEach(({ conn }) => {
      try { conn.send(payload); } catch (error) { /* ignore */ }
    });
    renderDiceTable();
  }

  function sendToDiceHost(message) {
    if (diceSync.conn && diceSync.conn.open) {
      try { diceSync.conn.send(message); } catch (error) { /* ignore */ }
    } else {
      showToast('尚未連上房主');
    }
  }

  function renderDiceQrGrid() {
    diceQrGrid.replaceChildren();
    if (typeof qrcode !== 'function') {
      diceQrGrid.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    const count = diceSync.players.length;
    for (let slot = 1; slot < count; slot += 1) {
      const url = `${base}?${new URLSearchParams({ dice: diceSync.code, p: String(slot) }).toString()}`;
      diceQrGrid.appendChild(buildQrCard(slot, url));
    }
    diceQrGrid.hidden = false;
  }

  function setupDiceHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { handleDiceHostMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => removeDiceHostConn(conn));
    conn.on('error', () => removeDiceHostConn(conn));
  }

  function handleDiceHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, diceSync.players.length - 1);
      conn.slot = slot;
      const name = validString(message.name, '').trim().slice(0, 14);
      if (diceSync.players[slot]) {
        if (name) diceSync.players[slot].name = name;
        diceSync.players[slot].online = true;
      }
      if (!diceSync.conns.some((entry) => entry.conn === conn)) diceSync.conns.push({ conn, slot });
      updateDiceSyncStatus(`房間代號 ${diceSync.code} · 已連線 ${diceSync.conns.length + 1}/${diceSync.players.length} 人`);
      renderDiceTable();
      broadcastDiceState();
    } else if (message.type === 'roll') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, diceSync.players.length - 1);
      const raw = Array.isArray(message.values) ? message.values : [];
      const values = raw
        .map((value) => clamp(Math.floor(Number(value) || 0), 1, state.dice.sides))
        .slice(0, state.dice.count);
      if (values.length === state.dice.count && diceSync.players[slot]) {
        diceSync.players[slot].values = values;
        diceSync.players[slot].lastAt = Date.now();
        renderDiceTable();
        broadcastDiceState();
      }
    } else if (message.type === 'name') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, diceSync.players.length - 1);
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${slot + 1}`;
      if (diceSync.players[slot]) {
        diceSync.players[slot].name = name;
        renderDiceTable();
        broadcastDiceState();
      }
    }
  }

  function removeDiceHostConn(conn) {
    const before = diceSync.conns.length;
    const removed = diceSync.conns.find((entry) => entry.conn === conn);
    diceSync.conns = diceSync.conns.filter((entry) => entry.conn !== conn);
    if (removed && diceSync.players[removed.slot]) diceSync.players[removed.slot].online = false;
    if (diceSync.conns.length !== before) {
      updateDiceSyncStatus(`房間代號 ${diceSync.code} · 已連線 ${diceSync.conns.length + 1}/${diceSync.players.length} 人`);
      renderDiceTable();
      broadcastDiceState();
    }
  }

  function resetDiceSync() {
    try { if (diceSync.peer) diceSync.peer.destroy(); } catch (error) { /* ignore */ }
    diceSync.mode = 'local';
    diceSync.code = '';
    diceSync.peer = null;
    diceSync.conns = [];
    diceSync.conn = null;
    diceSync.mySlot = 0;
    diceSync.ready = false;
    diceSync.privacy = 'public';
    diceSync.players = [];
    setDiceMode('local');
  }

  function createDiceRoom() {
    if (diceSync.mode !== 'local') return;
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    const code = makeRoomCode();
    const count = dicePlayerCount();
    const sides = state.dice.sides;
    const diceCount = state.dice.count;
    diceSync.code = code;
    diceSync.mySlot = 0;
    diceSync.conns = [];
    diceSync.privacy = 'public';
    diceSync.players = Array.from({ length: count }, (_, index) => ({
      name: `玩家 ${index + 1}`,
      values: Array.from({ length: diceCount }, () => randomInt(sides) + 1),
      online: index === 0,
      lastAt: Date.now(),
    }));
    state.dice.values = [...diceSync.players[0].values];
    saveState();
    renderDice();
    setDiceMode('host');
    updateDiceSyncStatus('建立中…');
    dicePeerCreate(`${DICE_HOST_PREFIX}${code.toLowerCase()}`);
  }

  function dicePeerCreate(hostId) {
    const peer = new Peer(hostId, { debug: 1 });
    diceSync.peer = peer;
    peer.on('open', () => {
      diceSync.ready = true;
      updateDiceSyncStatus(`房間代號 ${diceSync.code} · 等大家掃 QR 加入`);
      renderDiceTable();
      renderDiceQrGrid();
    });
    peer.on('connection', (conn) => setupDiceHostConnection(conn));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突，請重試'); resetDiceSync(); }
      else if (type === 'invalid-id') { showToast('連線設定錯誤'); resetDiceSync(); }
      else showToast('連線暫時不穩，仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function joinDiceRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      setDiceMode('local');
      return;
    }
    diceSync.code = code;
    diceSync.mySlot = slot;
    diceSync.conns = [];
    diceSync.players = [];
    setDiceMode('client');
    updateDiceSyncStatus(`正在連線「${code}」…`);
    const peer = new Peer(makeDiceClientId(code, slot), { debug: 1 });
    diceSync.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${DICE_HOST_PREFIX}${code.toLowerCase()}`, { reliable: true });
      diceSync.conn = conn;
      conn.on('open', () => {
        conn.send({ type: 'hello', slot, name: `玩家 ${slot + 1}` });
      });
      conn.on('data', (message) => { try { handleDiceClientMessage(message); } catch (error) { /* ignore */ } });
      conn.on('close', () => updateDiceSyncStatus('已中斷連線，請重新掃描 QR'));
      conn.on('error', () => updateDiceSyncStatus('連線中斷，請重新掃描 QR'));
    });
    peer.on('error', () => {
      showToast('連線失敗，請確認網路');
      updateDiceSyncStatus('連線失敗，請確認網路後重新掃描');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function handleDiceClientMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state' && Array.isArray(message.players)) {
      diceSync.players = message.players.map((player) => ({
        name: validString(player.name, '玩家').trim().slice(0, 14) || '玩家',
        values: Array.isArray(player.values)
          ? player.values.map((value) => clamp(Math.floor(Number(value) || 0), 1, 100))
          : [],
        online: player.online !== false,
      }));
      const settings = message.settings && typeof message.settings === 'object' ? message.settings : {};
      const count = clamp(Math.floor(Number(settings.count) || 5), 1, 12);
      const sides = clamp(Math.floor(Number(settings.sides) || 6), 2, 100);
      state.dice.count = count;
      state.dice.sides = sides;
      diceSync.privacy = message.privacy === 'hidden' ? 'hidden' : 'public';
      const me = diceSync.players[diceSync.mySlot];
      state.dice.values = me && me.values.length
        ? me.values.slice(0, count)
        : Array.from({ length: count }, () => randomInt(sides) + 1);
      diceSync.ready = true;
      saveState();
      updateDiceSyncStatus(`已連線 · 玩家 ${diceSync.mySlot + 1}`);
      $('#roomSettingsText').textContent = `${count} 顆 · ${sides} 面`;
      renderDice();
      applyDicePrivacy();
      showToast(`已加入骰子房間 ${diceSync.code}`);
    }
  }

  $$('[data-dice-privacy]').forEach((button) => {
    button.addEventListener('click', () => {
      if (diceSync.mode === 'client') return;
      diceSync.privacy = button.dataset.dicePrivacy === 'hidden' ? 'hidden' : 'public';
      syncDicePrivacyButtons();
      applyDicePrivacy();
      if (diceSync.mode === 'host') {
        broadcastDiceState();
        showToast(diceSync.privacy === 'hidden' ? '已切換：骰面隱藏（大話骰模式）' : '已切換：骰面公開');
      }
    });
  });

  $('#createDiceRoomButton').addEventListener('click', createDiceRoom);
  endDiceRoomButton.addEventListener('click', () => {
    resetDiceSync();
    showToast('已結束骰子房間');
  });
  $('#rerollAllButton').addEventListener('click', () => {
    if (diceSync.mode !== 'host') return;
    diceSync.players.forEach((player) => {
      player.values = Array.from({ length: state.dice.count }, () => randomInt(state.dice.sides) + 1);
      player.lastAt = Date.now();
    });
    if (diceSync.players[0]) state.dice.values = [...diceSync.players[0].values];
    saveState();
    renderDice(true);
    broadcastDiceState();
    showToast('新回合：全部重骰完成');
    vibrate([20, 30, 45]);
  });
  setDiceMode('local');

  // Collapsible how-to-play block, reused on setup panels' clients.
  function buildGameRules(title, rules) {
    const details = document.createElement('details');
    details.className = 'game-rules';
    const summary = document.createElement('summary');
    summary.textContent = `📖 ${title}`;
    details.appendChild(summary);
    rules.forEach((rule) => {
      const p = document.createElement('p');
      p.textContent = rule;
      details.appendChild(p);
    });
    return details;
  }

  // ===== 離線單機模式（Offline solo: one phone, pass it around） =====
  // 螢幕常亮：離線局全程傳手機，用 Wake Lock 避免手機熄屏（不支援的裝置自動略過）。
  const soloWake = { count: 0, lock: null };
  function soloRequestWakeLock() {
    try {
      if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
      navigator.wakeLock.request('screen').then((lock) => {
        soloWake.lock = lock;
        if (lock && typeof lock.addEventListener === 'function') {
          lock.addEventListener('release', () => { if (soloWake.lock === lock) soloWake.lock = null; });
        }
      }).catch(() => { /* wake lock is optional */ });
    } catch (error) { /* wake lock is optional */ }
  }
  function soloKeepScreenAwake() {
    soloWake.count += 1;
    if (soloWake.count === 1) soloRequestWakeLock();
  }
  function soloAllowScreenSleep() {
    soloWake.count = Math.max(0, soloWake.count - 1);
    if (soloWake.count === 0 && soloWake.lock) {
      try { soloWake.lock.release(); } catch (error) { /* ignore */ }
      soloWake.lock = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && soloWake.count > 0 && !soloWake.lock) soloRequestWakeLock();
  });

  function soloProgressNote(text) {
    const note = document.createElement('p');
    note.className = 'wolf-custom-summary solo-progress';
    note.textContent = text;
    return note;
  }

  // 黑色交接牌：輪到誰,手機就交給誰,本人點一下才看得到秘密。
  function soloHandoffCard(topLabel, nameText, actionHint) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'solo-deal-card';
    const label = document.createElement('span');
    label.className = 'solo-deal-label';
    label.textContent = topLabel;
    const name = document.createElement('strong');
    name.textContent = nameText;
    const hint = document.createElement('small');
    hint.textContent = actionHint;
    card.append(label, name, hint);
    return card;
  }

  // 點一下才顯示的秘密卡（夜晚查驗／換牌結果,只給當事人看）。
  function soloPeekCard(kicker, secret, hint) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-word-card solo-peek-card is-hidden';
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    label.textContent = kicker;
    const word = document.createElement('strong');
    word.textContent = secret;
    card.append(label, word);
    if (hint) {
      const note = document.createElement('p');
      note.className = 'role-desc';
      note.textContent = hint;
      card.appendChild(note);
    }
    card.addEventListener('click', () => card.classList.toggle('is-hidden'));
    return card;
  }

  // 黑色小卡名牌：玩家用手指比,主持人點卡代替投票。
  function soloCardGrid(entries, options = {}) {
    const grid = document.createElement('div');
    grid.className = 'solo-card-grid';
    entries.forEach((entry) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'solo-card' + (options.selectedSlot === entry.slot ? ' is-selected' : '');
      card.dataset.soloSlot = String(entry.slot);
      const rank = document.createElement('span');
      rank.className = 'solo-card-rank';
      rank.textContent = pad(entry.slot + 1);
      const name = document.createElement('span');
      name.className = 'solo-card-name';
      name.textContent = entry.name + (entry.suffix || '');
      card.append(rank, name);
      card.addEventListener('click', () => { if (options.onPick) options.onPick(entry); });
      grid.appendChild(card);
    });
    return grid;
  }

  // 離線傳手機時,本人順手改自己的顯示名稱。
  function soloNameEditor(player, slot, onRename) {
    const wrap = document.createElement('div');
    wrap.className = 'wolf-action';
    const label = document.createElement('h5');
    label.textContent = '你的顯示名稱（之後投票、點名都用它）';
    const input = document.createElement('input');
    input.className = 'sync-my-name';
    input.type = 'text';
    input.maxLength = 14;
    input.value = player.name;
    input.setAttribute('aria-label', '我的顯示名稱');
    input.addEventListener('change', () => {
      const value = input.value.trim().slice(0, 14) || `玩家 ${slot + 1}`;
      player.name = value;
      input.value = value;
      if (onRename) onRename();
    });
    wrap.append(label, input);
    return wrap;
  }

  // 「掃 QR 連線 / 離線單機」切換列。
  function initSoloToggle(rootId, onToggle) {
    const root = $(`#${rootId}`);
    let solo = false;
    $$('.solo-mode-option', root).forEach((button) => {
      button.addEventListener('click', () => {
        solo = button.dataset.playmode === 'solo';
        $$('.solo-mode-option', root).forEach((el) => el.classList.toggle('is-selected', el === button));
        onToggle(solo);
      });
    });
    return () => solo;
  }

  // Werewolf (secret roles + moderator flow, host + clients via PeerJS)
  const WOLF_HOST_PREFIX = 'pocket-wolf-';
  const wolfSync = {
    mode: 'local',       // 'local' | 'host' | 'client'
    solo: false,         // 離線單機：不連 PeerJS、不發 QR,輪流傳手機
    code: '',
    peer: null,
    conns: [],           // host: [{ conn, slot }]
    conn: null,          // client: single connection
    mySlot: 0,
    ready: false,
    config: null,        // { roles: [], voice: bool }
    players: [],         // [{ name, role, alive, joined, ready, acted, voteLocked, online }]
    steps: [],           // step objects
    stepIndex: -1,
    night: 0,
    targets: {},         // werewolf / guard / witch_save / witch_poison / seer / shoot
    witchUsed: { save: false, poison: false },
    lastGuardSlot: null,
    votes: {},           // voterSlot -> targetSlot (null = abstain)
    deadThisRound: [],
    over: null,
    resultForMe: null,
    witchVictim: null,
    timerLeft: 0,
    timerInterval: null,
    flipIdiot: null,
    hunterPending: null,
    pendingLastWords: false,
    myReveal: null,
  };
  const wolfPresetList = $('#wolfPresetList');
  const wolfCustom = $('#wolfCustom');
  const wolfVoiceToggle = $('#wolfVoiceToggle');
  const wolfSetupPanel = $('#wolfSetup');
  const wolfHostPanel = $('#wolfHost');
  const wolfClientPanel = $('#wolfClient');
  const wolfBadge = $('#wolfBadge');
  const wolfStatus = $('#wolfStatus');
  const wolfQrGrid = $('#wolfQrGrid');
  const wolfRoster = $('#wolfRoster');
  const wolfControl = $('#wolfControl');
  const wolfPhaseLabel = $('#wolfPhaseLabel');
  const wolfPhaseTitle = $('#wolfPhaseTitle');
  const wolfPhaseHint = $('#wolfPhaseHint');
  const wolfPhaseActions = $('#wolfPhaseActions');
  const wolfNextButton = $('#wolfNextButton');
  const endWolfRoomButton = $('#endWolfRoomButton');
  const wolfClientStatus = $('#wolfClientStatus');
  const wolfClientBody = $('#wolfClientBody');
  let wolfCustomRoles = [];
  let wolfSelectedPreset = null;
  // 離線單機狀態:發牌進度與收票進度。
  let wolfSoloDeal = { slot: 0, peeked: false };
  let wolfSoloVote = { idx: 0 };
  function resetWolfSoloState() {
    wolfSoloDeal = { slot: 0, peeked: false };
    wolfSoloVote = { idx: 0 };
  }

  function wolfRoleById(id) {
    return WOLF_ROLES[id] || { name: '村民', emoji: '👤', camp: 'village', desc: '' };
  }

  function wolfAliveCount() {
    return wolfSync.players.filter((player) => player.alive).length;
  }

  function wolfCountByRole(roleId) {
    return wolfSync.players.filter((player) => player.role === roleId && player.alive).length;
  }

  function checkWolfWinner() {
    const aliveWolves = wolfSync.players.filter((player) => player.role === 'werewolf' && player.alive).length;
    const aliveOthers = wolfSync.players.filter((player) => player.role !== 'werewolf' && player.alive).length;
    if (aliveWolves === 0) return { camp: 'village' };
    if (aliveOthers <= aliveWolves) return { camp: 'wolf' };
    return null;
  }

  function wolfPlayerName(slot) {
    const player = wolfSync.players[slot];
    return player ? player.name : `玩家 ${slot + 1}`;
  }

  function wolfCurrentStep() {
    return wolfSync.steps[wolfSync.stepIndex] || null;
  }

  function wolfPushSteps(steps) {
    steps.forEach((step) => {
      step.sequence = wolfSync.steps.length;
      wolfSync.steps.push(step);
    });
  }

  function wolfSpeak(text) {
    if (!globalVoice || !wolfSync.config || !wolfSync.config.voice) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95;
      synth.speak(utterance);
    } catch (error) { /* voice is optional */ }
  }

  // ---- Setup UI ----
  function renderWolfPresets() {
    wolfPresetList.replaceChildren();
    WOLF_PRESETS.forEach((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wolf-preset' + (index === 0 ? ' is-selected' : '');
      button.dataset.wolfPreset = preset.id;
      const title = document.createElement('strong');
      title.textContent = preset.label;
      const sub = document.createElement('span');
      sub.textContent = preset.desc;
      button.append(title, sub);
      button.addEventListener('click', () => {
        $$('.wolf-preset', wolfPresetList).forEach((el) => el.classList.remove('is-selected'));
        button.classList.add('is-selected');
        wolfCustomRoles = [...preset.roles];
        wolfSelectedPreset = preset;
        renderWolfCustom();
      });
      wolfPresetList.appendChild(button);
    });
    wolfCustomRoles = [...WOLF_PRESETS[0].roles];
    wolfSelectedPreset = WOLF_PRESETS[0];
    renderWolfCustom();
  }

  function renderWolfCustom() {
    wolfCustom.replaceChildren();
    wolfCustom.hidden = false;
    const step = document.createElement('div');
    step.className = 'wolf-step';
    const stepNo = document.createElement('span');
    stepNo.className = 'wolf-step-no';
    stepNo.textContent = 'STEP 2';
    const stepTitle = document.createElement('strong');
    stepTitle.textContent = '設定各角色人數';
    const stepSmall = document.createElement('small');
    stepSmall.textContent = wolfSelectedPreset ? `已帶入「${wolfSelectedPreset.label}」的配置,可再增減` : '可自由增減各角色人數';
    step.append(stepNo, stepTitle, stepSmall);
    wolfCustom.appendChild(step);
    const heading = document.createElement('div');
    heading.className = 'sync-heading';
    heading.style.marginBottom = '10px';
    const icon = document.createElement('div');
    icon.className = 'sync-icon wolf-sync-icon';
    icon.textContent = '⚙️';
    const copy = document.createElement('div');
    copy.className = 'sync-heading-copy';
    const kicker = document.createElement('p');
    kicker.className = 'tool-card-kicker';
    kicker.textContent = 'ROLE COUNTS';
    const h4 = document.createElement('h4');
    h4.textContent = '各角色人數';
    copy.append(kicker, h4);
    heading.append(icon, copy);
    const list = document.createElement('div');
    list.className = 'wolf-custom-roles';
    Object.keys(WOLF_ROLES).forEach((roleId) => {
      const row = document.createElement('div');
      row.className = 'wolf-custom-role';
      const label = document.createElement('span');
      label.textContent = `${WOLF_ROLES[roleId].emoji} ${WOLF_ROLES[roleId].name}`;
      const count = wolfCustomRoles.filter((id) => id === roleId).length;
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `減少${WOLF_ROLES[roleId].name}`);
      minus.disabled = count <= 0;
      minus.addEventListener('click', () => {
        const index = wolfCustomRoles.lastIndexOf(roleId);
        if (index >= 0) {
          wolfCustomRoles.splice(index, 1);
          $$('.wolf-preset', wolfPresetList).forEach((el) => el.classList.remove('is-selected'));
          renderWolfCustom();
        }
      });
      const value = document.createElement('strong');
      value.textContent = String(count);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '＋';
      plus.setAttribute('aria-label', `增加${WOLF_ROLES[roleId].name}`);
      plus.disabled = wolfCustomRoles.length >= 12;
      plus.addEventListener('click', () => {
        if (wolfCustomRoles.length < 12) {
          wolfCustomRoles.push(roleId);
          $$('.wolf-preset', wolfPresetList).forEach((el) => el.classList.remove('is-selected'));
          renderWolfCustom();
        }
      });
      row.append(label, minus, value, plus);
      list.appendChild(row);
    });
    const summary = document.createElement('p');
    summary.className = 'wolf-custom-summary';
    const wolves = wolfCustomRoles.filter((id) => id === 'werewolf').length;
    const total = wolfCustomRoles.length;
    summary.textContent = `目前 ${total} 人：${wolves} 狼 / ${total - wolves} 神民${wolves >= 1 && total - wolves >= wolves ? ' · 配置合理' : ' · 建議至少 1 狼,且好人不少於狼'}`;
    wolfCustom.append(heading, list, summary);
  }

  // ---- Step building ----
  function buildNightSteps(nightNo) {
    const steps = [];
    steps.push({
      id: 'night-open',
      label: `夜晚 · 第 ${nightNo} 晚`,
      title: `第 ${nightNo} 晚 · 天黑請閉眼`,
      hint: '所有人閉上眼睛,把手機蓋在桌上。',
      secs: 12,
      voice: '天黑請閉眼。請所有人閉上眼睛,把手機蓋在桌上。',
    });
    if (wolfCountByRole('werewolf') > 0) {
      steps.push({
        id: 'wolves',
        label: '夜晚 · 狼人',
        title: '狼人請睜眼',
        hint: '狼人商量要殺誰,由主持人代為選擇目標。',
        target: 'host',
        pick: 'werewolf',
        secs: 40,
        voice: '狼人請睜眼,請商量今晚要殺誰。',
      });
    }
    if (wolfCountByRole('guard') > 0) {
      steps.push({
        id: 'guard',
        label: '夜晚 · 守衛',
        title: '守衛請睜眼',
        hint: '守衛選擇要守護的玩家(不能連續兩晚守同一人)。',
        target: 'client',
        role: 'guard',
        pick: 'guard',
        secs: 30,
        voice: '守衛請睜眼,請選擇要守護的對象。',
      });
    }
    if (wolfCountByRole('witch') > 0 && !wolfSync.witchUsed.save) {
      steps.push({
        id: 'witch-save',
        label: '夜晚 · 女巫',
        title: '女巫請睜眼 · 解藥',
        hint: '主持人告知女巫今晚被殺的對象,女巫選擇是否使用解藥。',
        target: 'client',
        role: 'witch',
        pick: 'save',
        secs: 30,
        voice: '女巫請睜眼,主持人請告訴女巫今晚誰被殺了,女巫可以選擇使用解藥。',
      });
    }
    if (wolfCountByRole('witch') > 0 && !wolfSync.witchUsed.poison) {
      steps.push({
        id: 'witch-poison',
        label: '夜晚 · 女巫',
        title: '女巫請選擇毒藥',
        hint: '女巫可以選擇一名玩家下毒,或選擇不使用。',
        target: 'client',
        role: 'witch',
        pick: 'poison',
        secs: 30,
        voice: '女巫可以選擇使用毒藥。',
      });
    }
    if (wolfCountByRole('seer') > 0) {
      steps.push({
        id: 'seer',
        label: '夜晚 · 預言家',
        title: '預言家請睜眼',
        hint: '預言家查驗一名玩家的身份。',
        target: 'client',
        role: 'seer',
        pick: 'check',
        secs: 30,
        voice: '預言家請睜眼,請查驗一名玩家的身份。',
      });
    }
    steps.push({
      id: 'dawn',
      label: `天亮 · 第 ${nightNo + 1} 天`,
      title: '天亮了',
      hint: '公布昨晚結果。',
      secs: 15,
      voice: '天亮了,請大家睜開眼睛。',
    });
    return steps;
  }

  function buildDaySteps(dayNo) {
    const steps = [];
    steps.push({
      id: 'day-discuss',
      label: `白天 · 第 ${dayNo} 天`,
      title: '白天討論',
      hint: '大家公開討論,找出狼人。',
      secs: 90,
      timer: true,
      voice: '現在是白天討論時間,請大家踴躍發言。',
    });
    steps.push({
      id: 'day-vote',
      label: '白天 · 投票',
      title: '投票時間',
      hint: '所有人用手機投票,選出要放逐的人。',
      target: 'clients',
      secs: 60,
      timer: true,
      voice: '請大家開始投票。',
    });
    steps.push({
      id: 'day-result',
      label: '白天 · 結果',
      title: '公布投票結果',
      hint: '主持人按下「收票」後公布結果。',
      secs: 15,
      voice: '公布投票結果。',
    });
    return steps;
  }

  function ensureWolfSteps() {
    if (wolfSync.steps.length === 0) {
      wolfSync.steps.push({
        id: 'reveal',
        label: '發牌',
        title: '翻牌確認身份',
        hint: '每個人先在自己手機上「改好顯示名稱」再按「看完了」。全部確認後開始夜晚。',
        secs: 0,
        voice: '請每個人看自己手機上的角色,先改好顯示名稱,確認完畢後按「看完了」。',
      });
      wolfPushSteps(buildNightSteps(1));
      wolfPushSteps(buildDaySteps(1));
    }
  }

  // ---- Resolutions ----
  function wolfResolveDawn() {
    const killed = Number.isInteger(wolfSync.targets.werewolf) ? wolfSync.targets.werewolf : null;
    const deaths = [];
    if (killed !== null) {
      const saved = wolfSync.targets.witch_save === killed;
      const guarded = wolfSync.targets.guard === killed;
      if (!saved && !guarded) deaths.push(killed);
    }
    if (Number.isInteger(wolfSync.targets.witch_poison)) deaths.push(wolfSync.targets.witch_poison);
    const unique = [...new Set(deaths)];
    unique.forEach((slot) => {
      if (wolfSync.players[slot] && wolfSync.players[slot].alive) wolfSync.players[slot].alive = false;
    });
    wolfSync.deadThisRound = unique.filter((slot) => wolfSync.players[slot]);
    if (Number.isInteger(wolfSync.targets.guard)) wolfSync.lastGuardSlot = wolfSync.targets.guard;
    // A hunter killed at night (or poisoned) may shoot once.
    const hunterDeath = unique.find((slot) => wolfSync.players[slot] && wolfSync.players[slot].role === 'hunter');
    if (Number.isInteger(hunterDeath)) wolfSync.hunterPending = hunterDeath;
    // 獵人還沒開槍前不判定勝負:他可能帶走一隻狼翻盤。
    wolfSync.over = Number.isInteger(wolfSync.hunterPending) ? null : checkWolfWinner();
  }

  function wolfResolveVote() {
    const tally = {};
    Object.values(wolfSync.votes).forEach((target) => {
      if (Number.isInteger(target)) tally[target] = (tally[target] || 0) + 1;
    });
    let max = 0;
    let maxSlot = null;
    let tie = false;
    Object.entries(tally).forEach(([slotKey, count]) => {
      const slot = Number(slotKey);
      if (count > max) {
        max = count;
        maxSlot = slot;
        tie = false;
      } else if (count === max) {
        tie = true;
      }
    });
    wolfSync.votes = {};
    let eliminated = null;
    if (!tie && maxSlot !== null && max > 0) eliminated = maxSlot;
    wolfSync.deadThisRound = [];
    wolfSync.flipIdiot = null;
    wolfSync.hunterPending = null;
    wolfSync.pendingLastWords = false;
    if (eliminated !== null) {
      const player = wolfSync.players[eliminated];
      if (player.role === 'idiot' && player.alive) {
        // 白痴翻牌免死,之後失去投票權
        player.voteLocked = true;
        wolfSync.flipIdiot = eliminated;
      } else {
        player.alive = false;
        wolfSync.deadThisRound = [eliminated];
        if (player.role === 'hunter') wolfSync.hunterPending = eliminated;
        else wolfSync.pendingLastWords = true;
      }
    }
    // 獵人還沒開槍前不判定勝負:他可能帶走一隻狼翻盤。
    wolfSync.over = Number.isInteger(wolfSync.hunterPending) ? null : checkWolfWinner();
  }

  function wolfResolveShoot() {
    const target = wolfSync.targets.shoot;
    wolfSync.hunterPending = null;
    if (Number.isInteger(target)) {
      const player = wolfSync.players[target];
      if (player && player.alive) {
        player.alive = false;
        if (!wolfSync.deadThisRound.includes(target)) wolfSync.deadThisRound.push(target);
      }
    }
    wolfSync.over = checkWolfWinner();
  }

  function wolfInsertStepAfter(step) {
    const insertAt = wolfSync.stepIndex + 1;
    step.sequence = insertAt;
    wolfSync.steps.splice(insertAt, 0, step);
  }

  // ---- Host advance ----
  function wolfAdvance() {
    const leaving = wolfCurrentStep();
    if (leaving && leaving.id === 'hunter') wolfResolveShoot();
    if (leaving && leaving.id === 'last-words') wolfSync.pendingLastWords = false;
    // Insert hunter / last-words right after the vote result (before the next night).
    if (leaving && leaving.id === 'dawn' && Number.isInteger(wolfSync.hunterPending)) {
      wolfInsertStepAfter({
        id: 'hunter',
        label: '白天 · 獵人開槍',
        title: '獵人請開槍',
        hint: '獵人被殺,選擇要帶走的人,或選擇不開槍。',
        target: 'host',
        pick: 'shoot',
        secs: 30,
        timer: true,
        voice: '獵人可以開槍帶走一名玩家。',
      });
    }
    if (leaving && leaving.id === 'day-result') {
      if (Number.isInteger(wolfSync.hunterPending)) {
        wolfInsertStepAfter({
          id: 'hunter',
          label: '白天 · 獵人開槍',
          title: '獵人請開槍',
          hint: '獵人被放逐,選擇要帶走的人,或選擇不開槍。',
          target: 'host',
          pick: 'shoot',
          secs: 30,
          timer: true,
          voice: '獵人可以開槍帶走一名玩家。',
        });
      } else if (wolfSync.pendingLastWords) {
        wolfInsertStepAfter({
          id: 'last-words',
          label: '遺言時間',
          title: '遺言時間',
          hint: '被放逐的玩家說遺言。',
          secs: 30,
          timer: true,
          voice: '請說遺言。',
        });
      }
    } else if (leaving && leaving.id === 'hunter' && wolfSync.pendingLastWords) {
      wolfInsertStepAfter({
        id: 'last-words',
        label: '遺言時間',
        title: '遺言時間',
        hint: '被放逐的玩家說遺言。',
        secs: 30,
        timer: true,
        voice: '請說遺言。',
      });
    }
    wolfSync.stepIndex += 1;
    if (!wolfCurrentStep()) {
      wolfSync.night += 1;
      wolfPushSteps(buildNightSteps(wolfSync.night + 1));
      wolfPushSteps(buildDaySteps(wolfSync.night + 1));
    }
    if (wolfSync.over && wolfCurrentStep().id !== 'over') {
      wolfPushSteps([{
        id: 'over',
        label: '遊戲結束',
        title: wolfSync.over.camp === 'wolf' ? '狼人陣營獲勝' : '好人陣營獲勝',
        hint: '',
        secs: 0,
        voice: wolfSync.over.camp === 'wolf' ? '狼人陣營獲勝' : '好人陣營獲勝',
      }]);
      wolfSync.stepIndex = wolfSync.steps.length - 1;
    }
    enterWolfStep();
  }

  // 離線單機時,部分階段的標題與提示改成「傳手機 / 代投」的說法。
  function wolfSoloStepCopy(step) {
    if (!wolfSync.solo || !step) return null;
    if (step.id === 'reveal') {
      return { title: '傳手機發牌', hint: '把手機輪流傳給每位玩家:看身份、順手改顯示名稱,蓋牌後傳給下一位。' };
    }
    if (step.id === 'day-vote') {
      return { title: '投票 · 主持人代投', hint: '輪到的玩家用手指比人,主持人點黑卡收票;收齊後自動計票。' };
    }
    if (step.target === 'client') {
      return { hint: '本人睜眼用手比,主持人代為點選;畫面只給本人看。' };
    }
    return null;
  }

  function enterWolfStep() {
    const step = wolfCurrentStep();
    if (!step) return;
    // Resolve on entry so the step's display already shows the outcome.
    if (step.id === 'dawn') wolfResolveDawn();
    if (step.id === 'day-result') wolfResolveVote();
    if (step.id === 'night-open') {
      wolfSync.targets = {};
      wolfSync.witchVictim = null;
      wolfSync.deadThisRound = [];
      wolfSync.flipIdiot = null;
    }
    if (step.id === 'day-discuss') {
      wolfSync.deadThisRound = [];
      wolfSync.flipIdiot = null;
      wolfSync.votes = {};
      wolfSoloVote = { idx: 0 };
    }
    wolfSync.resultForMe = null;
    wolfSync.players.forEach((player) => { player.acted = false; });
    if (wolfSync.mode === 'host') {
      const copy = wolfSoloStepCopy(step);
      wolfPhaseLabel.textContent = step.label || '';
      wolfPhaseTitle.textContent = copy && copy.title ? copy.title : (step.title || '');
      renderWolfPhaseHint();
      renderWolfPhaseActions();
      renderWolfRoster();
      if (wolfSync.timerInterval) { window.clearInterval(wolfSync.timerInterval); wolfSync.timerInterval = null; }
      wolfSync.timerLeft = step.timer ? step.secs : 0;
      if (step.timer) {
        wolfSync.timerInterval = window.setInterval(() => {
          wolfSync.timerLeft = Math.max(0, wolfSync.timerLeft - 1);
          renderWolfPhaseHint();
        }, 1000);
        renderWolfPhaseHint();
      }
      wolfSpeak(step.voice || '');
    } else {
      renderWolfClient();
    }
    broadcastWolfState();
  }

  function renderWolfPhaseHint() {
    const step = wolfCurrentStep();
    if (!step) return;
    const copy = wolfSync.mode === 'host' ? wolfSoloStepCopy(step) : null;
    let text = (copy && copy.hint) || step.hint || '';
    if (step.timer) {
      const minutes = Math.floor(wolfSync.timerLeft / 60);
      const seconds = wolfSync.timerLeft % 60;
      text += `（${pad(minutes)}:${pad(seconds)}）`;
    }
    wolfPhaseHint.textContent = text;
    wolfPhaseHint.classList.toggle('wolf-timer', step.timer);
  }

  // ---- Host renderers ----
  function renderWolfRoster() {
    wolfRoster.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'list-heading';
    const left = document.createElement('span');
    // 離線發牌中手機會傳到每個人手上,貓紙(身份總覽)先藏起來,發完才顯示。
    const dealing = wolfSync.solo
      && wolfCurrentStep() && wolfCurrentStep().id === 'reveal'
      && wolfSoloDeal.slot < wolfSync.players.length;
    if (dealing) {
      left.textContent = `發牌中 · ${wolfSoloDeal.slot}/${wolfSync.players.length} 已看牌`;
      heading.appendChild(left);
      wolfRoster.appendChild(heading);
      wolfSync.players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'wolf-player';
        const rank = document.createElement('span');
        rank.className = 'wolf-player-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('strong');
        name.className = 'wolf-player-name';
        name.textContent = player.name;
        const status = document.createElement('span');
        status.className = 'wolf-player-role';
        status.textContent = index < wolfSoloDeal.slot ? '✅ 已看牌' : '🂠 待看牌';
        row.append(rank, name, status);
        wolfRoster.appendChild(row);
      });
      return;
    }
    left.textContent = `身份總覽（貓紙）· ${wolfAliveCount()} 存活`;
    heading.appendChild(left);
    wolfRoster.appendChild(heading);
    wolfSync.players.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'wolf-player'
        + (index === wolfSync.mySlot ? ' is-me' : '')
        + (player.alive ? '' : ' is-dead');
      const rank = document.createElement('span');
      rank.className = 'wolf-player-rank';
      rank.textContent = pad(index + 1);
      let nameEl;
      if (index === wolfSync.mySlot) {
        nameEl = document.createElement('input');
        nameEl.className = 'wolf-player-name-input';
        nameEl.type = 'text';
        nameEl.maxLength = 14;
        nameEl.value = player.name;
        nameEl.setAttribute('aria-label', '我的名字');
        nameEl.addEventListener('change', () => {
          const value = nameEl.value.trim().slice(0, 14) || `玩家 ${index + 1}`;
          wolfSync.players[index].name = value;
          if (wolfSync.mode === 'client') sendToWolfHost({ type: 'name', slot: index, name: value });
          else broadcastWolfState();
        });
      } else {
        nameEl = document.createElement('strong');
        nameEl.className = 'wolf-player-name';
        nameEl.textContent = player.name + (player.online === false ? '（離線）' : '');
      }
      const role = document.createElement('span');
      role.className = 'wolf-player-role';
      const roleInfo = wolfRoleById(player.role);
      role.textContent = `${roleInfo.emoji} ${roleInfo.name}`;
      row.append(rank, nameEl, role);
      wolfRoster.appendChild(row);
    });
  }

  function wolfAliveTargets(excludeSelfSlot) {
    return wolfSync.players
      .map((player, slot) => ({ ...player, slot }))
      .filter((player) => player.alive && player.slot !== excludeSelfSlot);
  }

  function wolfTargetList(targets, pick, options = {}) {
    const list = document.createElement('div');
    list.className = 'wolf-target-list';
    targets.forEach((player) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wolf-target';
      button.disabled = (options.disabled && options.disabled(player)) || false;
      const rank = document.createElement('span');
      rank.className = 'wolf-target-rank';
      rank.textContent = pad(player.slot + 1);
      const name = document.createElement('span');
      name.className = 'wolf-target-name';
      name.textContent = player.name + (player.slot === wolfSync.mySlot && !wolfSync.solo ? '（你）' : '');
      button.append(rank, name);
      if (options.badge) {
        const badge = document.createElement('span');
        badge.className = 'wolf-target-badge';
        badge.textContent = options.badge(player);
        button.appendChild(badge);
      }
      button.addEventListener('click', () => {
        if (options.onPick) { options.onPick(player); return; }
        if (wolfSync.mode === 'client') {
          sendToWolfHost({ type: 'act', slot: wolfSync.mySlot, pick, target: player.slot, use: options.use === true });
          button.disabled = true;
          button.classList.add('is-selected');
        } else {
          wolfSync.targets[pick] = player.slot;
          renderWolfPhaseActions();
        }
      });
      list.appendChild(button);
    });
    return list;
  }

  function wolfOptionButton(label, onClick, selected = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wolf-option-button' + (selected ? ' is-selected' : '');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  // Reusable editor for a client's display name (host uses it to recognise people).
  function wolfNameEditor() {
    const me = wolfSync.players[wolfSync.mySlot];
    const wrap = document.createElement('div');
    if (!me) return wrap;
    wrap.className = 'wolf-action';
    const labelEl = document.createElement('h5');
    labelEl.textContent = '顯示名稱（主持人靠這個認人）';
    const nameInput = document.createElement('input');
    nameInput.className = 'sync-my-name';
    nameInput.type = 'text';
    nameInput.maxLength = 14;
    nameInput.value = me.name;
    nameInput.setAttribute('aria-label', '我的顯示名稱');
    nameInput.addEventListener('change', () => {
      const value = nameInput.value.trim().slice(0, 14) || `玩家 ${wolfSync.mySlot + 1}`;
      wolfSync.players[wolfSync.mySlot].name = value;
      sendToWolfHost({ type: 'name', slot: wolfSync.mySlot, name: value });
      renderWolfClient();
    });
    wrap.append(labelEl, nameInput);
    return wrap;
  }

  // Host acts on behalf of a role that lives on the host's own phone (slot 0).
  function wolfHostActionUI(step) {
    const self = wolfSync.players[0];
    const actor = wolfSync.players.find((player) => player.role === step.role && player.alive && !player.acted);
    if (!actor || actor.slot !== 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'wolf-action';
    const heading = document.createElement('h5');
    heading.textContent = `${wolfRoleById(step.role).emoji} ${wolfRoleById(step.role).name}行動（你是該角色,直接代為選擇）`;
    wrap.appendChild(heading);
    if (step.pick === 'save') {
      const victim = wolfSync.targets.werewolf;
      if (Number.isInteger(victim)) {
        const info = document.createElement('p');
        info.className = 'wolf-custom-summary';
        info.textContent = `今晚被狼人殺的是 ${wolfPlayerName(victim)}`;
        wrap.appendChild(info);
        const useBtn = document.createElement('button');
        useBtn.className = 'button button-primary button-large';
        useBtn.type = 'button';
        useBtn.textContent = '🧪 使用解藥救他';
        useBtn.addEventListener('click', () => {
          wolfSync.targets.witch_save = victim;
          wolfSync.witchUsed.save = true;
          self.acted = true;
          renderWolfPhaseActions();
        });
        const noBtn = document.createElement('button');
        noBtn.className = 'button button-quiet button-large';
        noBtn.type = 'button';
        noBtn.textContent = '不使用解藥';
        noBtn.addEventListener('click', () => {
          wolfSync.witchUsed.save = true;
          self.acted = true;
          renderWolfPhaseActions();
        });
        wrap.append(useBtn, noBtn);
      } else {
        const info = document.createElement('p');
        info.className = 'wolf-custom-summary';
        info.textContent = '等待狼人行動…';
        wrap.appendChild(info);
      }
    } else if (step.pick === 'poison') {
      const skip = wolfOptionButton('不使用毒藥', () => {
        wolfSync.witchUsed.poison = true;
        self.acted = true;
        renderWolfPhaseActions();
      });
      wrap.appendChild(skip);
      wolfPhaseActions.appendChild(wrap);
      const targets = wolfAliveTargets(0);
      wolfPhaseActions.appendChild(wolfTargetList(targets, 'poison', {
        onPick: (player) => {
          wolfSync.targets.witch_poison = player.slot;
          wolfSync.witchUsed.poison = true;
          self.acted = true;
          renderWolfPhaseActions();
        },
      }));
      return;
    } else if (step.pick === 'guard') {
      const targets = wolfAliveTargets(0).filter((player) => player.slot !== wolfSync.lastGuardSlot);
      wolfPhaseActions.appendChild(wrap);
      wolfPhaseActions.appendChild(wolfTargetList(targets, 'guard', {
        onPick: (player) => {
          wolfSync.targets.guard = player.slot;
          self.acted = true;
          renderWolfPhaseActions();
        },
      }));
      return;
    } else if (step.pick === 'check') {
      const targets = wolfAliveTargets(0);
      wolfPhaseActions.appendChild(wrap);
      wolfPhaseActions.appendChild(wolfTargetList(targets, 'check', {
        onPick: (player) => {
          wolfSync.targets.seer = player.slot;
          self.acted = true;
          renderWolfPhaseActions();
        },
      }));
      return;
    }
    wolfPhaseActions.appendChild(wrap);
  }

  function wolfNextLabel(step) {
    switch (step.id) {
      case 'reveal': return '開始夜晚 <span>↗</span>';
      case 'dawn': return '開始白天討論 <span>↗</span>';
      case 'day-discuss': return '開始投票 <span>↗</span>';
      case 'day-vote': return '收票 <span>↗</span>';
      case 'day-result': return '繼續 <span>↗</span>';
      case 'hunter': return '確認開槍 <span>↗</span>';
      case 'last-words': return '進入下一階段 <span>↗</span>';
      default: return '下一步 <span>↗</span>';
    }
  }

  // ---- 離線單機:傳手機發牌 ----
  function wolfSoloDealUI() {
    const total = wolfSync.players.length;
    const dealt = Math.min(wolfSoloDeal.slot, total);
    if (dealt >= total) {
      wolfPhaseActions.appendChild(soloProgressNote(`✅ ${total} 人都看過身份了,手機交回主持人。`));
      return;
    }
    const player = wolfSync.players[dealt];
    if (!wolfSoloDeal.peeked) {
      wolfPhaseActions.appendChild(soloProgressNote(`傳手機發牌 · 第 ${dealt + 1}/${total} 位`));
      const card = soloHandoffCard('請把手機交給', `${pad(dealt + 1)} ${player.name}`, '本人拿起手機後,點這張黑牌看身份');
      card.addEventListener('click', () => {
        wolfSoloDeal.peeked = true;
        renderWolfPhaseActions();
      });
      wolfPhaseActions.appendChild(card);
      return;
    }
    const roleInfo = wolfRoleById(player.role);
    const reveal = document.createElement('div');
    reveal.className = 'wolf-reveal';
    const emoji = document.createElement('div');
    emoji.className = 'wolf-reveal-emoji';
    emoji.textContent = roleInfo.emoji;
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    label.textContent = `${player.name} · 你的秘密身份`;
    const title = document.createElement('strong');
    title.className = 'wolf-client-role-name';
    title.textContent = roleInfo.name;
    const desc = document.createElement('p');
    desc.className = 'role-desc';
    desc.textContent = roleInfo.desc;
    reveal.append(emoji, label, title, desc);
    wolfPhaseActions.appendChild(reveal);
    wolfPhaseActions.appendChild(soloNameEditor(player, dealt, () => { broadcastWolfState(); }));
    const action = document.createElement('div');
    action.className = 'wolf-action';
    const done = document.createElement('button');
    done.className = 'button button-primary button-large';
    done.type = 'button';
    done.innerHTML = dealt + 1 >= total ? '看完了,交回主持人 <span>▣</span>' : '看完了,蓋牌給下一位 <span>▣</span>';
    done.addEventListener('click', () => {
      player.ready = true;
      wolfSoloDeal.slot = dealt + 1;
      wolfSoloDeal.peeked = false;
      renderWolfPhaseActions();
      renderWolfRoster();
    });
    action.appendChild(done);
    wolfPhaseActions.appendChild(action);
  }

  // ---- 離線單機:夜晚角色行動(本人比手勢,主持人代點) ----
  function wolfSoloActionUI(step) {
    const roleInfo = wolfRoleById(step.role);
    const wrap = document.createElement('div');
    wrap.className = 'wolf-action';
    const heading = document.createElement('h5');
    heading.textContent = `${roleInfo.emoji} ${roleInfo.name}行動 · 本人比手勢,主持人代點`;
    wrap.appendChild(heading);
    wolfPhaseActions.appendChild(wrap);
    const actor = wolfSync.players.find((player) => player.role === step.role && player.alive);
    if (!actor) {
      wolfPhaseActions.appendChild(soloProgressNote('✅ 此角色已不在場,直接下一步。'));
      return;
    }
    const actorSlot = wolfSync.players.indexOf(actor);
    if (actor.acted) {
      if (step.pick === 'check' && Number.isInteger(wolfSync.targets.seer)) {
        const target = wolfSync.players[wolfSync.targets.seer];
        wolfPhaseActions.appendChild(soloPeekCard(
          '🔮 查驗結果（拿給預言家看）',
          `${target.name} 是 ${target.role === 'werewolf' ? '🐺 狼人' : '😇 好人'}`,
          '點一下顯示、再點一下藏起來,只給預言家看。',
        ));
      } else {
        wolfPhaseActions.appendChild(soloProgressNote('✅ 已行動完成,可以下一步。'));
      }
      return;
    }
    if (step.pick === 'save') {
      const victim = wolfSync.targets.werewolf;
      if (Number.isInteger(victim)) {
        const info = document.createElement('p');
        info.className = 'wolf-custom-summary';
        info.textContent = `今晚被殺的是 ${wolfPlayerName(victim)} — 私下告訴女巫(或拿手機給她看)`;
        wrap.appendChild(info);
        const useBtn = document.createElement('button');
        useBtn.className = 'button button-primary button-large';
        useBtn.type = 'button';
        useBtn.textContent = '🧪 使用解藥救他';
        useBtn.addEventListener('click', () => {
          wolfSync.targets.witch_save = victim;
          wolfSync.witchUsed.save = true;
          actor.acted = true;
          renderWolfPhaseActions();
        });
        const noBtn = document.createElement('button');
        noBtn.className = 'button button-quiet button-large';
        noBtn.type = 'button';
        noBtn.textContent = '不使用解藥';
        noBtn.addEventListener('click', () => {
          wolfSync.witchUsed.save = true;
          actor.acted = true;
          renderWolfPhaseActions();
        });
        wrap.append(useBtn, noBtn);
      } else {
        const info = document.createElement('p');
        info.className = 'wolf-custom-summary';
        info.textContent = '等待狼人行動…';
        wrap.appendChild(info);
      }
      return;
    }
    if (step.pick === 'poison') {
      const skip = wolfOptionButton('不使用毒藥', () => {
        wolfSync.witchUsed.poison = true;
        actor.acted = true;
        renderWolfPhaseActions();
      });
      wolfPhaseActions.appendChild(skip);
      const targets = wolfAliveTargets(actorSlot);
      wolfPhaseActions.appendChild(wolfTargetList(targets, 'poison', {
        onPick: (player) => {
          wolfSync.targets.witch_poison = player.slot;
          wolfSync.witchUsed.poison = true;
          actor.acted = true;
          renderWolfPhaseActions();
        },
      }));
      return;
    }
    if (step.pick === 'guard') {
      const targets = wolfAliveTargets(actorSlot).filter((player) => player.slot !== wolfSync.lastGuardSlot);
      wolfPhaseActions.appendChild(wolfTargetList(targets, 'guard', {
        onPick: (player) => {
          wolfSync.targets.guard = player.slot;
          actor.acted = true;
          renderWolfPhaseActions();
        },
      }));
      return;
    }
    if (step.pick === 'check') {
      const targets = wolfAliveTargets(actorSlot);
      wolfPhaseActions.appendChild(wolfTargetList(targets, 'check', {
        onPick: (player) => {
          wolfSync.targets.seer = player.slot;
          actor.acted = true;
          renderWolfPhaseActions();
        },
      }));
      return;
    }
  }

  // ---- 離線單機:白天投票(玩家指人,主持人點黑卡) ----
  // 回傳 true = 票已收齊。
  function wolfSoloVoteUI() {
    const eligible = wolfSync.players
      .map((player, slot) => ({ ...player, slot }))
      .filter((player) => player.alive && !player.voteLocked);
    const collected = eligible.filter((player) => wolfSync.votes[player.slot] !== undefined).length;
    wolfPhaseActions.appendChild(soloProgressNote(`主持人代投 · 已收 ${collected}/${eligible.length} 票`));
    if (wolfSoloVote.idx >= eligible.length) {
      const collect = document.createElement('button');
      collect.className = 'button button-secondary';
      collect.type = 'button';
      collect.innerHTML = '收票並公布結果 <span>↗</span>';
      collect.addEventListener('click', () => {
        wolfSync.stepIndex += 1;
        enterWolfStep();
      });
      wolfPhaseActions.appendChild(collect);
      return true;
    }
    const voter = eligible[wolfSoloVote.idx];
    const who = document.createElement('p');
    who.className = 'solo-vote-who';
    who.textContent = `現在投票：${pad(voter.slot + 1)} ${voter.name} — 用手指比,主持人點卡`;
    wolfPhaseActions.appendChild(who);
    const entries = wolfSync.players
      .map((player, slot) => ({ ...player, slot }))
      .filter((player) => player.alive && player.slot !== voter.slot);
    wolfPhaseActions.appendChild(soloCardGrid(entries, {
      selectedSlot: wolfSync.votes[voter.slot],
      onPick: (entry) => {
        wolfSync.votes[voter.slot] = entry.slot;
        wolfSoloVote.idx += 1;
        renderWolfPhaseActions();
      },
    }));
    const row = document.createElement('div');
    row.className = 'solo-row';
    const abstain = wolfOptionButton('這票棄權', () => {
      wolfSync.votes[voter.slot] = null;
      wolfSoloVote.idx += 1;
      renderWolfPhaseActions();
    });
    const redo = wolfOptionButton('↩︎ 重收上一票', () => {
      if (wolfSoloVote.idx > 0) {
        wolfSoloVote.idx -= 1;
        const prev = eligible[wolfSoloVote.idx];
        if (prev) delete wolfSync.votes[prev.slot];
        renderWolfPhaseActions();
      }
    });
    redo.disabled = wolfSoloVote.idx === 0;
    row.append(abstain, redo);
    wolfPhaseActions.appendChild(row);
    return false;
  }

  function renderWolfPhaseActions() {
    wolfPhaseActions.replaceChildren();
    const step = wolfCurrentStep();
    if (!step) return;
    const solo = wolfSync.solo === true;
    let hideNext = false;
    if (step.target === 'host' && step.pick) {
      // Host picks a target directly (wolves kill / hunter shoot).
      let targets = wolfAliveTargets(null);
      if (step.pick === 'werewolf') targets = targets.filter((player) => player.role !== 'werewolf');
      const pickKey = step.pick;
      wolfPhaseActions.appendChild(wolfTargetList(targets, pickKey));
      if (Number.isInteger(wolfSync.targets[pickKey])) {
        const status = document.createElement('p');
        status.className = 'wolf-custom-summary';
        status.textContent = `已選擇：${wolfPlayerName(wolfSync.targets[pickKey])}`;
        wolfPhaseActions.appendChild(status);
      }
      if (step.pick === 'shoot') {
        const skip = wolfOptionButton('不開槍', () => {
          wolfSync.targets.shoot = null;
          renderWolfPhaseActions();
        });
        wolfPhaseActions.appendChild(skip);
      }
    } else if (step.target === 'client') {
      if (solo) {
        wolfSoloActionUI(step);
      } else {
        const actor = wolfSync.players.find((player) => player.role === step.role && player.alive && !player.acted);
        if (actor && actor.slot === 0) {
          wolfHostActionUI(step);
        } else {
          const status = document.createElement('p');
          status.className = 'wolf-custom-summary';
          status.textContent = actor
            ? `等待 ${actor.name}（${wolfRoleById(step.role).name}）行動…`
            : '✅ 已行動完成';
          wolfPhaseActions.appendChild(status);
          if (actor) {
            const skip = document.createElement('button');
            skip.className = 'text-button';
            skip.type = 'button';
            skip.textContent = '跳過此步（裝置故障時）';
            skip.addEventListener('click', () => {
              actor.acted = true;
              renderWolfPhaseActions();
            });
            wolfPhaseActions.appendChild(skip);
          }
        }
      }
    } else if (step.target === 'clients') {
      if (solo) {
        hideNext = !wolfSoloVoteUI();
      } else {
        const eligible = wolfSync.players.filter((player) => player.alive && !player.voteLocked);
        const voted = eligible.filter((player) => wolfSync.votes[wolfSync.players.indexOf(player)] !== undefined).length;
        const status = document.createElement('p');
        status.className = 'wolf-custom-summary';
        status.textContent = `已投票 ${voted} / ${eligible.length} 人`;
        wolfPhaseActions.appendChild(status);
        const collect = document.createElement('button');
        collect.className = 'button button-secondary';
        collect.type = 'button';
        collect.innerHTML = '收票並公布結果 <span>↗</span>';
        collect.addEventListener('click', () => {
          wolfSync.stepIndex += 1;
          enterWolfStep();
        });
        wolfPhaseActions.appendChild(collect);
      }
    }
    if (step.id === 'reveal') {
      if (solo) {
        wolfSoloDealUI();
        hideNext = hideNext || wolfSoloDeal.slot < wolfSync.players.length;
      } else {
        const confirmed = wolfSync.players.filter((player) => player.ready).length;
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = `已確認 ${confirmed} / ${wolfSync.players.length} 人`;
        wolfPhaseActions.appendChild(note);
      }
    }
    if (solo && step.id === 'dawn') {
      const summary = document.createElement('p');
      summary.className = 'wolf-custom-summary';
      if (wolfSync.deadThisRound.length) {
        const names = wolfSync.deadThisRound.map((slot) => `${wolfPlayerName(slot)}(${wolfRoleById(wolfSync.players[slot].role).name})`).join('、');
        summary.textContent = `☀️ 昨晚出局：${names}`;
      } else {
        summary.textContent = '☀️ 昨晚是平安夜,無人死亡。';
      }
      wolfPhaseActions.appendChild(summary);
    }
    if (solo && step.id === 'day-result') {
      const summary = document.createElement('p');
      summary.className = 'wolf-custom-summary';
      if (wolfSync.flipIdiot !== null) {
        summary.textContent = `🙃 ${wolfPlayerName(wolfSync.flipIdiot)} 翻牌是白痴,免死!之後失去投票權。`;
      } else if (wolfSync.deadThisRound.length) {
        const names = wolfSync.deadThisRound.map((slot) => `${wolfPlayerName(slot)}(${wolfRoleById(wolfSync.players[slot].role).name})`).join('、');
        summary.textContent = `🗳️ 出局：${names}`;
      } else {
        summary.textContent = '🗳️ 平票或全棄權,無人出局。';
      }
      wolfPhaseActions.appendChild(summary);
    }
    if (step.id === 'over') {
      wolfNextButton.hidden = true;
      const winner = document.createElement('div');
      winner.className = 'wolf-winner';
      winner.textContent = wolfSync.over && wolfSync.over.camp === 'wolf' ? '🐺 狼人陣營獲勝' : '🌞 好人陣營獲勝';
      wolfPhaseActions.appendChild(winner);
    } else {
      wolfNextButton.hidden = hideNext;
      wolfNextButton.innerHTML = wolfNextLabel(step);
    }
  }

  wolfNextButton.addEventListener('click', () => {
    if (wolfSync.mode !== 'host') return;
    const step = wolfCurrentStep();
    if (!step || step.id === 'over') return;
    if (step.id === 'reveal') {
      wolfSync.players.forEach((player) => { player.ready = false; });
    }
    wolfAdvance();
  });

  // ---- Mode / status ----
  function wolfSetMode(mode) {
    wolfSync.mode = mode;
    const connected = mode !== 'local';
    wolfSetupPanel.hidden = connected;
    wolfHostPanel.hidden = mode !== 'host';
    wolfClientPanel.hidden = mode !== 'client';
    endWolfRoomButton.hidden = !connected;
    if (!connected) {
      wolfStatus.hidden = true;
      wolfQrGrid.hidden = true;
      wolfControl.hidden = true;
    } else {
      wolfStatus.hidden = false;
      wolfControl.hidden = mode !== 'host';
      if (mode === 'client') wolfQrGrid.hidden = true;
    }
    if (mode === 'host') renderWolfRoster();
    if (mode === 'client') renderWolfClient();
  }

  function wolfUpdateStatus(text) {
    wolfStatus.textContent = text;
    wolfStatus.hidden = false;
  }

  function wolfClientUpdateStatus(text) {
    wolfClientStatus.textContent = text;
    wolfClientStatus.hidden = false;
  }

  function makeWolfClientId(code, slot) {
    return `${WOLF_HOST_PREFIX}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function broadcastWolfState() {
    const payload = {
      type: 'state',
      players: wolfSync.players.map((player) => ({
        name: player.name,
        role: player.role,
        alive: player.alive,
        joined: player.joined,
        ready: player.ready,
        acted: player.acted,
        voteLocked: player.voteLocked,
        online: player.online !== false,
      })),
      stepIndex: wolfSync.stepIndex,
      steps: wolfSync.steps.map((step) => ({
        id: step.id, label: step.label, title: step.title, hint: step.hint,
        target: step.target, role: step.role, pick: step.pick, timer: Boolean(step.timer),
      })),
      night: wolfSync.night,
      targets: { ...wolfSync.targets },
      witchUsed: { ...wolfSync.witchUsed },
      lastGuardSlot: wolfSync.lastGuardSlot,
      deadThisRound: [...wolfSync.deadThisRound],
      over: wolfSync.over,
      votes: { ...wolfSync.votes },
      resultForMe: null,
      witchVictim: null,
      flipIdiot: wolfSync.flipIdiot ?? null,
      hunterPending: wolfSync.hunterPending ?? null,
      myReveal: null,
    };
    const step = wolfSync.steps[wolfSync.stepIndex];
    wolfSync.conns.forEach(({ conn, slot }) => {
      const me = payload.players[slot] || {};
      const myCopy = JSON.parse(JSON.stringify(payload));
      // Secret roles: scrub everyone's role except the recipient's own.
      myCopy.players = myCopy.players.map((player, index) => (
        index === slot ? player : { ...player, role: null }
      ));
      // Seer result goes only to the seer.
      if (step && step.pick === 'check' && me.role === 'seer' && Number.isInteger(wolfSync.targets.seer)) {
        const targetPlayer = wolfSync.players[wolfSync.targets.seer];
        myCopy.resultForMe = {
          type: 'check',
          target: wolfSync.targets.seer,
          targetName: targetPlayer ? targetPlayer.name : '',
          isWolf: targetPlayer ? targetPlayer.role === 'werewolf' : false,
        };
      }
      // Witch victim is revealed only to the witch.
      if (step && step.id === 'witch-save' && me.role === 'witch' && Number.isInteger(wolfSync.targets.werewolf)) {
        myCopy.witchVictim = wolfSync.targets.werewolf;
      }
      // A dead player sees their own role revealed.
      if (me.alive === false) {
        myCopy.myReveal = me.role;
      }
      // Hunter pending: reveal only to the hunter themselves.
      if (Number.isInteger(wolfSync.hunterPending) && me.role === 'hunter' && me.alive === false) {
        myCopy.hunterPending = wolfSync.hunterPending;
      }
      try { conn.send(myCopy); } catch (error) { /* ignore */ }
    });
    renderWolfHostView();
  }

  function renderWolfHostView() {
    if (wolfSync.mode !== 'host') return;
    renderWolfPhaseActions();
    renderWolfRoster();
  }

  function sendToWolfHost(message) {
    if (wolfSync.conn && wolfSync.conn.open) {
      try { wolfSync.conn.send(message); } catch (error) { /* ignore */ }
    } else {
      showToast('尚未連上主持人');
    }
  }

  function setupWolfHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { handleWolfHostMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => removeWolfHostConn(conn));
    conn.on('error', () => removeWolfHostConn(conn));
  }

  function handleWolfHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, wolfSync.players.length - 1);
      conn.slot = slot;
      const name = validString(message.name, '').trim().slice(0, 14);
      if (wolfSync.players[slot]) {
        wolfSync.players[slot].joined = true;
        wolfSync.players[slot].online = true;
        if (name) wolfSync.players[slot].name = name;
      }
      if (!wolfSync.conns.some((entry) => entry.conn === conn)) wolfSync.conns.push({ conn, slot });
      const joined = wolfSync.players.filter((player) => player.joined).length;
      wolfUpdateStatus(`房間代號 ${wolfSync.code} · 已加入 ${joined}/${wolfSync.players.length} 人`);
      broadcastWolfState();
    } else if (message.type === 'ready') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, wolfSync.players.length - 1);
      if (wolfSync.players[slot]) wolfSync.players[slot].ready = true;
      broadcastWolfState();
    } else if (message.type === 'act') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, wolfSync.players.length - 1);
      const step = wolfCurrentStep();
      const player = wolfSync.players[slot];
      if (!step || !player || player.role !== step.role || !player.alive) return;
      if (step.pick === 'guard') {
        const target = clamp(Math.floor(Number(message.target) || 0), 0, wolfSync.players.length - 1);
        if (wolfSync.players[target] && wolfSync.players[target].alive) wolfSync.targets.guard = target;
      } else if (step.pick === 'save') {
        wolfSync.witchUsed.save = true;
        if (message.use === true) {
          const target = clamp(Math.floor(Number(message.target) || 0), 0, wolfSync.players.length - 1);
          if (wolfSync.players[target]) wolfSync.targets.witch_save = target;
        }
      } else if (step.pick === 'poison') {
        wolfSync.witchUsed.poison = true;
        if (message.use === true) {
          const target = clamp(Math.floor(Number(message.target) || 0), 0, wolfSync.players.length - 1);
          if (wolfSync.players[target] && wolfSync.players[target].alive) wolfSync.targets.witch_poison = target;
        }
      } else if (step.pick === 'check') {
        const target = clamp(Math.floor(Number(message.target) || 0), 0, wolfSync.players.length - 1);
        if (wolfSync.players[target] && wolfSync.players[target].alive) wolfSync.targets.seer = target;
      }
      player.acted = true;
      broadcastWolfState();
    } else if (message.type === 'vote') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, wolfSync.players.length - 1);
      const step = wolfCurrentStep();
      const player = wolfSync.players[slot];
      if (step && step.id === 'day-vote' && player && player.alive && !player.voteLocked) {
        const target = message.target === null
          ? null
          : clamp(Math.floor(Number(message.target) || 0), 0, wolfSync.players.length - 1);
        if (target === null || (wolfSync.players[target] && wolfSync.players[target].alive)) {
          wolfSync.votes[slot] = target;
        }
        broadcastWolfState();
      }
    } else if (message.type === 'name') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, wolfSync.players.length - 1);
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${slot + 1}`;
      if (wolfSync.players[slot]) {
        const oldName = wolfSync.players[slot].name;
        wolfSync.players[slot].name = name;
        if (oldName !== name) showToast(`${oldName} 改名為 ${name}`);
        broadcastWolfState();
      }
    }
  }

  function removeWolfHostConn(conn) {
    const before = wolfSync.conns.length;
    const removed = wolfSync.conns.find((entry) => entry.conn === conn);
    wolfSync.conns = wolfSync.conns.filter((entry) => entry.conn !== conn);
    if (removed && wolfSync.players[removed.slot]) wolfSync.players[removed.slot].online = false;
    if (wolfSync.conns.length !== before) {
      const joined = wolfSync.players.filter((player) => player.joined).length;
      wolfUpdateStatus(`房間代號 ${wolfSync.code} · 已加入 ${joined}/${wolfSync.players.length} 人`);
      broadcastWolfState();
    }
  }

  function resetWolfSync() {
    if (wolfSync.timerInterval) { window.clearInterval(wolfSync.timerInterval); wolfSync.timerInterval = null; }
    try { if (wolfSync.peer) wolfSync.peer.destroy(); } catch (error) { /* ignore */ }
    wolfSync.mode = 'local';
    wolfSync.code = '';
    wolfSync.peer = null;
    wolfSync.conns = [];
    wolfSync.conn = null;
    wolfSync.mySlot = 0;
    wolfSync.ready = false;
    wolfSync.config = null;
    wolfSync.players = [];
    wolfSync.steps = [];
    wolfSync.stepIndex = -1;
    wolfSync.night = 0;
    wolfSync.targets = {};
    wolfSync.witchUsed = { save: false, poison: false };
    wolfSync.lastGuardSlot = null;
    wolfSync.votes = {};
    wolfSync.deadThisRound = [];
    wolfSync.over = null;
    wolfSync.resultForMe = null;
    wolfSync.witchVictim = null;
    wolfSync.timerLeft = 0;
    wolfSync.flipIdiot = null;
    wolfSync.hunterPending = null;
    wolfSync.pendingLastWords = false;
    wolfSync.myReveal = null;
    if (wolfSync.solo) soloAllowScreenSleep();
    wolfSync.solo = false;
    resetWolfSoloState();
    wolfBadge.textContent = '房主';
    wolfSetMode('local');
  }

  function createWolfRoom() {
    if (wolfSync.mode !== 'local') return;
    const solo = wolfSoloWanted();
    if (!solo && typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      return;
    }
    const wolves = wolfCustomRoles.filter((id) => id === 'werewolf').length;
    const total = wolfCustomRoles.length;
    if (total < 4) { showToast('至少需要 4 位玩家'); return; }
    if (wolves < 1) { showToast('至少要 1 隻狼'); return; }
    if (total - wolves < wolves) { showToast('好人數量要比狼多'); return; }
    const code = makeRoomCode();
    const roles = [...wolfCustomRoles];
    for (let index = roles.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [roles[index], roles[swapIndex]] = [roles[swapIndex], roles[index]];
    }
    wolfSync.solo = solo;
    resetWolfSoloState();
    wolfSync.code = code;
    wolfSync.mySlot = 0;
    wolfSync.conns = [];
    wolfSync.config = { roles, voice: wolfVoiceToggle.checked };
    wolfSync.players = roles.map((role, index) => ({
      name: `玩家 ${index + 1}`,
      role,
      alive: true,
      joined: solo || index === 0,
      ready: false,
      acted: false,
      voteLocked: false,
      online: solo || index === 0,
    }));
    wolfSync.steps = [];
    wolfSync.stepIndex = -1;
    wolfSync.night = 0;
    ensureWolfSteps();
    wolfSync.stepIndex = 0;
    wolfSetMode('host');
    if (solo) {
      wolfBadge.textContent = '離線單機';
      wolfUpdateStatus('離線單機 · 免網路、免 QR,輪流傳手機;螢幕保持常亮');
      soloKeepScreenAwake();
      wolfQrGrid.hidden = true;
      enterWolfStep();
      return;
    }
    wolfBadge.textContent = '房主';
    wolfUpdateStatus('建立中…');
    wolfQrGrid.hidden = true;
    wolfPeerCreate(`${WOLF_HOST_PREFIX}${code.toLowerCase()}`);
    enterWolfStep();
  }

  function wolfPeerCreate(hostId) {
    const peer = new Peer(hostId, { debug: 1 });
    wolfSync.peer = peer;
    peer.on('open', () => {
      wolfSync.ready = true;
      wolfUpdateStatus(`房間代號 ${wolfSync.code} · 等大家掃 QR 加入`);
      renderWolfQrGrid();
      renderWolfHostView();
    });
    peer.on('connection', (conn) => setupWolfHostConnection(conn));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突,請重試'); resetWolfSync(); }
      else if (type === 'invalid-id') { showToast('連線設定錯誤'); resetWolfSync(); }
      else showToast('連線暫時不穩,仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function renderWolfQrGrid() {
    wolfQrGrid.replaceChildren();
    if (typeof qrcode !== 'function') {
      wolfQrGrid.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    for (let slot = 1; slot < wolfSync.players.length; slot += 1) {
      const url = `${base}?${new URLSearchParams({ wolf: wolfSync.code, p: String(slot) }).toString()}`;
      wolfQrGrid.appendChild(buildQrCard(slot, url, '掃描後設定名字,再查看秘密身份'));
    }
    wolfQrGrid.hidden = false;
  }

  function joinWolfRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      wolfSetMode('local');
      return;
    }
    wolfSync.code = code;
    wolfSync.mySlot = slot;
    wolfSync.conns = [];
    wolfSync.players = [];
    wolfSetMode('client');
    wolfClientUpdateStatus(`正在連線「${code}」…`);
    const peer = new Peer(makeWolfClientId(code, slot), { debug: 1 });
    wolfSync.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${WOLF_HOST_PREFIX}${code.toLowerCase()}`, { reliable: true });
      wolfSync.conn = conn;
      conn.on('open', () => {
        conn.send({ type: 'hello', slot, name: `玩家 ${slot + 1}` });
      });
      conn.on('data', (message) => { try { handleWolfClientMessage(message); } catch (error) { /* ignore */ } });
      conn.on('close', () => wolfClientUpdateStatus('已中斷連線,請重新掃描 QR'));
      conn.on('error', () => wolfClientUpdateStatus('連線中斷,請重新掃描 QR'));
    });
    peer.on('error', () => {
      showToast('連線失敗,請確認網路');
      wolfClientUpdateStatus('連線失敗,請確認網路後重新掃描');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function handleWolfClientMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state' && Array.isArray(message.players)) {
      wolfSync.players = message.players.map((player) => ({
        name: validString(player.name, '玩家').trim().slice(0, 14) || '玩家',
        role: player.role || null,
        alive: player.alive !== false,
        joined: Boolean(player.joined),
        ready: Boolean(player.ready),
        acted: Boolean(player.acted),
        voteLocked: Boolean(player.voteLocked),
        online: player.online !== false,
      }));
      wolfSync.steps = message.steps || [];
      wolfSync.stepIndex = message.stepIndex || 0;
      wolfSync.night = message.night || 0;
      wolfSync.targets = message.targets || {};
      wolfSync.witchUsed = message.witchUsed || { save: false, poison: false };
      wolfSync.lastGuardSlot = message.lastGuardSlot ?? null;
      wolfSync.deadThisRound = message.deadThisRound || [];
      wolfSync.over = message.over || null;
      wolfSync.votes = message.votes || {};
      wolfSync.resultForMe = message.resultForMe || null;
      wolfSync.witchVictim = message.witchVictim ?? null;
      wolfSync.flipIdiot = message.flipIdiot ?? null;
      wolfSync.hunterPending = message.hunterPending ?? null;
      wolfSync.myReveal = message.myReveal || null;
      wolfSync.ready = true;
      wolfClientUpdateStatus(`已連線 · 玩家 ${wolfSync.mySlot + 1}`);
      renderWolfClient();
    }
  }

  function renderWolfClient() {
    if (wolfSync.mode !== 'client') return;
    wolfClientBody.replaceChildren();
    const me = wolfSync.players[wolfSync.mySlot];
    if (!me) {
      const p = document.createElement('p');
      p.className = 'wolf-custom-summary';
      p.textContent = '等待主持人同步資料…';
      wolfClientBody.appendChild(p);
      return;
    }
    const myRole = wolfRoleById(me.role);
    const step = wolfSync.steps[wolfSync.stepIndex] || null;
    // Victory screen only on the dedicated 'over' step, so death announcements
    // (dawn / day-result) still show first.
    if (step && step.id === 'over') {
      const reveal = document.createElement('div');
      reveal.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = wolfSync.over.camp === 'wolf' ? '🐺' : '🌞';
      const title = document.createElement('strong');
      title.textContent = wolfSync.over.camp === 'wolf' ? '狼人陣營獲勝' : '好人陣營獲勝';
      const win = document.createElement('p');
      win.className = 'role-desc';
      const wolfWin = wolfSync.over.camp === 'wolf' && myRole.camp === 'wolf';
      const villageWin = wolfSync.over.camp === 'village' && myRole.camp !== 'wolf';
      win.textContent = (wolfWin || villageWin) ? '🎉 你獲勝了!' : '你輸了,下局再加油!';
      const roleLine = document.createElement('p');
      roleLine.className = 'role-desc';
      roleLine.textContent = `你的身份是 ${myRole.emoji} ${myRole.name}`;
      reveal.append(emoji, title, win, roleLine);
      wolfClientBody.appendChild(reveal);
      return;
    }
    if (!step) return;
    const nightActions = ['night-open', 'wolves', 'guard', 'witch-save', 'witch-poison', 'seer'];
    const isMyActionStep = step.target === 'client' && step.role === me.role && me.alive && !me.acted;

    // Reveal phase: show my secret role.
    if (step.id === 'reveal') {
      const reveal = document.createElement('div');
      reveal.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = myRole.emoji;
      const label = document.createElement('span');
      label.className = 'wolf-phase-label';
      label.textContent = '你的秘密身份';
      const title = document.createElement('strong');
      title.className = 'wolf-client-role-name';
      title.textContent = myRole.name;
      const desc = document.createElement('p');
      desc.className = 'role-desc';
      desc.textContent = myRole.desc;
      reveal.append(emoji, label, title, desc);
      wolfClientBody.appendChild(reveal);
      wolfClientBody.appendChild(wolfNameEditor());
      wolfClientBody.appendChild(buildGameRules('狼人殺怎麼玩?', [
        '陣營:狼人 vs 好人(神職 + 村民)。夜晚主持人帶流程,白天討論後手機投票放逐。',
        '勝利:所有狼人被放逐 → 好人贏;存活好人 ≤ 狼人 → 狼人贏。',
        '角色:🔮 預言家查驗、🧪 女巫解藥/毒藥、🛡️ 守衛保護、🔫 獵人死時開槍、🙃 白痴被放逐免死。',
      ]));
      const action = document.createElement('div');
      action.className = 'wolf-action';
      const done = document.createElement('button');
      done.className = 'button button-primary button-large';
      done.type = 'button';
      if (me.ready) {
        done.textContent = '已確認 ✅';
        done.disabled = true;
      } else {
        done.innerHTML = '看完了,蓋牌 <span>▣</span>';
        done.addEventListener('click', () => {
          wolfSync.players[wolfSync.mySlot].ready = true;
          sendToWolfHost({ type: 'ready', slot: wolfSync.mySlot });
          renderWolfClient();
        });
      }
      action.appendChild(done);
      wolfClientBody.appendChild(action);
      return;
    }

    // Night: black screen unless it's my own action.
    if (nightActions.includes(step.id) && !isMyActionStep) {
      // I already acted on this night step: show my private result or a done note.
      if (step.target === 'client' && step.role === me.role && me.acted) {
        if (step.pick === 'check' && wolfSync.resultForMe) {
          const result = document.createElement('div');
          result.className = 'wolf-action';
          const h = document.createElement('h5');
          h.textContent = '🔮 查驗結果';
          const p = document.createElement('p');
          p.className = 'wolf-custom-summary';
          p.textContent = `${wolfSync.resultForMe.targetName} 是 ${wolfSync.resultForMe.isWolf ? '🐺 狼人' : '😇 好人'}`;
          result.append(h, p);
          wolfClientBody.appendChild(result);
          return;
        }
        const done = document.createElement('div');
        done.className = 'wolf-black';
        done.textContent = '✅ 已行動完成,請閉眼等待。';
        wolfClientBody.appendChild(done);
        return;
      }
      const black = document.createElement('div');
      black.className = 'wolf-black';
      const text = document.createElement('span');
      text.textContent = '天黑請閉眼\n把手機蓋在桌上';
      black.appendChild(text);
      wolfClientBody.appendChild(black);
      return;
    }

    // My night action.
    if (isMyActionStep) {
      const action = document.createElement('div');
      action.className = 'wolf-action';
      const heading = document.createElement('h5');
      heading.textContent = `${myRole.emoji} ${myRole.name}行動`;
      action.appendChild(heading);
      wolfClientBody.appendChild(action);
      if (step.pick === 'save') {
        const victimSlot = wolfSync.witchVictim;
        if (Number.isInteger(victimSlot)) {
          const victimName = wolfSync.players[victimSlot] ? wolfSync.players[victimSlot].name : '？';
          const info = document.createElement('p');
          info.className = 'wolf-custom-summary';
          info.textContent = `今晚被狼人殺的是 ${victimName}`;
          action.appendChild(info);
          const saveBtn = document.createElement('button');
          saveBtn.className = 'button button-primary button-large';
          saveBtn.type = 'button';
          saveBtn.textContent = '🧪 使用解藥救他';
          saveBtn.addEventListener('click', () => {
            wolfSync.players[wolfSync.mySlot].acted = true;
            sendToWolfHost({ type: 'act', slot: wolfSync.mySlot, pick: 'save', use: true, target: victimSlot });
            renderWolfClient();
          });
          const noBtn = document.createElement('button');
          noBtn.className = 'button button-quiet button-large';
          noBtn.type = 'button';
          noBtn.textContent = '不使用解藥';
          noBtn.addEventListener('click', () => {
            wolfSync.players[wolfSync.mySlot].acted = true;
            sendToWolfHost({ type: 'act', slot: wolfSync.mySlot, pick: 'save', use: false });
            renderWolfClient();
          });
          action.append(saveBtn, noBtn);
        } else {
          const info = document.createElement('p');
          info.className = 'wolf-custom-summary';
          info.textContent = '等待主持人告知被殺對象…';
          action.appendChild(info);
        }
        return;
      }
      if (step.pick === 'poison') {
        const skip = wolfOptionButton('不使用毒藥', () => {
          wolfSync.players[wolfSync.mySlot].acted = true;
          sendToWolfHost({ type: 'act', slot: wolfSync.mySlot, pick: 'poison', use: false });
          renderWolfClient();
        });
        wolfClientBody.appendChild(skip);
        const targets = wolfAliveTargets(wolfSync.mySlot);
        wolfClientBody.appendChild(wolfTargetList(targets, 'poison', { use: true }));
        return;
      }
      if (step.pick === 'guard') {
        const targets = wolfAliveTargets(wolfSync.mySlot).filter((player) => player.slot !== wolfSync.lastGuardSlot);
        wolfClientBody.appendChild(wolfTargetList(targets, 'guard'));
        return;
      }
      if (step.pick === 'check') {
        const targets = wolfAliveTargets(wolfSync.mySlot);
        wolfClientBody.appendChild(wolfTargetList(targets, 'check'));
        return;
      }
      return;
    }

    // Day steps.
    if (step.id === 'day-discuss') {
      const card = document.createElement('div');
      card.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = myRole.emoji;
      const title = document.createElement('strong');
      title.textContent = `白天討論中 · 你是${myRole.name}`;
      const sub = document.createElement('p');
      sub.className = 'role-desc';
      sub.textContent = '參與討論,找出狼人!';
      card.append(emoji, title, sub);
      wolfClientBody.appendChild(card);
      // 忘了在發牌時改名?白天討論也可以改。
      wolfClientBody.appendChild(wolfNameEditor());
      const list = document.createElement('div');
      list.className = 'wolf-target-list';
      wolfSync.players.forEach((player, index) => {
        if (!player.alive) return;
        const row = document.createElement('div');
        row.className = 'wolf-target';
        row.style.cursor = 'default';
        const rank = document.createElement('span');
        rank.className = 'wolf-target-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('span');
        name.className = 'wolf-target-name';
        name.textContent = player.name + (index === wolfSync.mySlot ? '（你）' : '');
        row.append(rank, name);
        list.appendChild(row);
      });
      wolfClientBody.appendChild(list);
      return;
    }
    if (step.id === 'day-vote') {
      const card = document.createElement('div');
      card.className = 'wolf-action';
      const h = document.createElement('h5');
      h.textContent = '投票:要放逐誰?';
      card.appendChild(h);
      wolfClientBody.appendChild(card);
      if (me.voteLocked) {
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = '你是白痴,已翻牌,本局失去投票權。';
        wolfClientBody.appendChild(note);
        return;
      }
      const list = document.createElement('div');
      list.className = 'wolf-target-list';
      wolfSync.players.forEach((player, index) => {
        if (!player.alive || index === wolfSync.mySlot) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wolf-target' + (wolfSync.votes[wolfSync.mySlot] === index ? ' is-selected' : '');
        const rank = document.createElement('span');
        rank.className = 'wolf-target-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('span');
        name.className = 'wolf-target-name';
        name.textContent = player.name;
        button.append(rank, name);
        button.addEventListener('click', () => {
          sendToWolfHost({ type: 'vote', slot: wolfSync.mySlot, target: index });
          renderWolfClient();
        });
        list.appendChild(button);
      });
      const abstain = document.createElement('button');
      abstain.type = 'button';
      abstain.className = 'wolf-option-button' + (wolfSync.votes[wolfSync.mySlot] === null ? ' is-selected' : '');
      abstain.textContent = '棄權';
      abstain.addEventListener('click', () => {
        sendToWolfHost({ type: 'vote', slot: wolfSync.mySlot, target: null });
        renderWolfClient();
      });
      list.appendChild(abstain);
      wolfClientBody.appendChild(list);
      if (wolfSync.votes[wolfSync.mySlot] !== undefined) {
        const done = document.createElement('p');
        done.className = 'wolf-custom-summary';
        done.textContent = '✅ 已投票,可以修改直到主持人收票。';
        wolfClientBody.appendChild(done);
      }
      return;
    }
    if (step.id === 'dawn' || step.id === 'day-result' || step.id === 'last-words') {
      const card = document.createElement('div');
      card.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = '🌅';
      const title = document.createElement('strong');
      if (step.id === 'last-words') {
        title.textContent = '遺言時間';
      } else if (wolfSync.flipIdiot !== null) {
        title.textContent = '白痴翻牌免死';
      } else if (wolfSync.deadThisRound.length) {
        const names = wolfSync.deadThisRound.map((slot) => wolfSync.players[slot] ? wolfSync.players[slot].name : '？').join('、');
        title.textContent = `${step.id === 'dawn' ? '昨晚出局' : '出局'}：${names}`;
      } else {
        title.textContent = step.id === 'dawn' ? '昨晚平安夜' : '平票,無人出局';
      }
      const sub = document.createElement('p');
      sub.className = 'role-desc';
      if (wolfSync.deadThisRound.includes(wolfSync.mySlot)) {
        sub.textContent = `你出局了,你的身份是 ${myRole.emoji} ${myRole.name}`;
      } else if (step.id === 'last-words' && wolfSync.pendingLastWords) {
        sub.textContent = '請死者留下最後發言。';
      } else {
        sub.textContent = '請繼續遊戲。';
      }
      card.append(emoji, title, sub);
      wolfClientBody.appendChild(card);
      return;
    }
    const fallback = document.createElement('div');
    fallback.className = 'wolf-black';
    fallback.textContent = '請稍候…';
    wolfClientBody.appendChild(fallback);
    if (wolfSync.over) {
      const banner = document.createElement('div');
      banner.className = 'wolf-winner';
      banner.textContent = wolfSync.over.camp === 'wolf' ? '🐺 狼人陣營獲勝' : '🌞 好人陣營獲勝';
      wolfClientBody.appendChild(banner);
    }
  }

  $('#createWolfRoomButton').addEventListener('click', createWolfRoom);
  const wolfSoloWanted = initSoloToggle('wolfPlayMode', (solo) => {
    $('#createWolfRoomButton').innerHTML = solo ? '開始離線單機局 <span>📴</span>' : '建立狼人殺房間 <span>↗</span>';
    $('#wolfOnlineCopy').hidden = solo;
    $('#wolfSoloCopy').hidden = !solo;
  });
  endWolfRoomButton.addEventListener('click', () => {
    resetWolfSync();
    showToast('已結束遊戲');
  });
  wolfVoiceToggle.addEventListener('change', () => {
    if (wolfSync.config) wolfSync.config.voice = wolfVoiceToggle.checked;
  });
  renderWolfPresets();
  wolfSetMode('local');

  // ===== 誰是臥底 / 間諜危機 (secret words + vote, host + clients via PeerJS) =====
  const SPY_HOST_PREFIX = 'pocket-spy-';
  const SPY_THEMES = {
    party: {
      label: '派對',
      pairs: [['啤酒', '清酒'], ['KTV', '酒吧'], ['麻將', '撲克牌'], ['烤肉', '火鍋'], ['生日蛋糕', '結婚蛋糕'], ['煙火', '燈籠'], ['夾娃娃機', '扭蛋機'], ['遊樂園', '夜市'], ['露營', '野餐'], ['跨年晚會', '中秋烤肉']],
      places: ['KTV', '酒吧', '夜市', '公園', '露營區', '演唱會', '電影院', '遊樂園'],
    },
    food: {
      label: '飲食',
      pairs: [['奶茶', '咖啡'], ['漢堡', '三明治'], ['披薩', '餡餅'], ['餃子', '雲吞'], ['蛋糕', '麵包'], ['可樂', '雪碧'], ['火鍋', '麻辣燙'], ['拉麵', '烏冬麵'], ['水餃', '鍋貼'], ['冰淇淋', '霜淇淋'], ['泡麵', '麵線'], ['臭豆腐', '納豆']],
      places: ['餐廳', '夜市', '咖啡廳', '火鍋店', '早餐店', '超市', '茶餐廳', '速食店'],
    },
    life: {
      label: '生活',
      pairs: [['貓', '狗'], ['電影', '電視劇'], ['手機', '平板'], ['書', '雜誌'], ['雨傘', '雨衣'], ['冰箱', '冰櫃'], ['鬧鐘', '手錶'], ['洗衣機', '烘乾機'], ['枕頭', '抱枕'], ['拖鞋', '涼鞋'], ['紙巾', '手帕'], ['腳踏車', '自行車']],
      places: ['電影院', '健身房', '圖書館', '游泳池', '公園', '超市', '百貨公司', '美容院'],
    },
    work: {
      label: '職場',
      pairs: [['老師', '教授'], ['醫生', '護士'], ['經理', '總監'], ['律師', '法官'], ['會計', '出納'], ['程式員', '設計師'], ['記者', '編輯'], ['廚師', '服務生'], ['開會', '報告'], ['加班', '值班'], ['主管', '老闆'], ['警察', '捕快']],
      places: ['辦公室', '會議室', '銀行', '學校', '醫院', '警局', '律師樓', '電視台'],
    },
    travel: {
      label: '旅遊',
      pairs: [['高鐵', '火車'], ['飛機', '郵輪'], ['飯店', '民宿'], ['海灘', '游泳池'], ['機場', '車站'], ['導遊', '領隊'], ['行李箱', '背包'], ['護照', '身份證'], ['自由行', '跟團'], ['紀念品', '伴手禮']],
      places: ['機場', '火車站', '飯店', '海灘', '博物館', '遊樂園', '觀光巴士', '纜車站'],
    },
    tech: {
      label: '科技生活',
      pairs: [['手機', '平板'], ['電腦', '筆電'], ['耳機', '麥克風'], ['相機', '手機'], ['手錶', '鬧鐘'], ['充電器', '行動電源'], ['電視', '投影機'], ['鍵盤', '鋼琴'], ['滑鼠', '老鼠'], ['遊戲機', '電腦'], ['隨身碟', '記憶卡'], ['密碼', '指紋鎖']],
      places: ['手機店', '電腦展', '網咖', '電玩店', '3C賣場', '影音店', '相機店', '家電賣場'],
    },
    people: {
      label: '人物身份',
      pairs: [['醫生', '護士'], ['老師', '教授'], ['警察', '消防員'], ['廚師', '服務生'], ['明星', '網紅'], ['主播', '記者'], ['老闆', '主管'], ['運動員', '教練'], ['郵差', '快遞員'], ['空服員', '導遊'], ['福爾摩斯', '工藤新一'], ['梁山伯與祝英台', '羅密歐與茱麗葉']],
      places: ['醫院', '學校', '警局', '消防局', '電視台', '辦公室', '郵局', '餐廳'],
    },
    animal: {
      label: '動物',
      pairs: [['貓', '狗'], ['老虎', '獅子'], ['大象', '河馬'], ['猴子', '猩猩'], ['兔子', '老鼠'], ['烏龜', '蝸牛'], ['企鵝', '海豹'], ['老鷹', '烏鴉'], ['鯊魚', '鯨魚'], ['蝴蝶', '蜜蜂'], ['海豚', '海獅'], ['老虎', '豹']],
      places: ['動物園', '寵物店', '水族館', '森林', '農場', '獸醫院', '鳥園', '馬戲團'],
    },
    entertain: {
      label: '娛樂影視',
      pairs: [['電影', '電視劇'], ['演唱會', '音樂會'], ['遊樂園', '動物園'], ['麻將', '撲克牌'], ['跳舞', '唱歌'], ['直播', '錄影'], ['抖音', 'IG'], ['五月天', '蘇打綠'], ['周杰倫', '林俊傑'], ['密室逃脫', '劇本殺'], ['KTV', '卡拉OK'], ['漫畫', '小說']],
      places: ['電影院', '演唱會場', '遊樂園', 'KTV', '酒吧', '夜市', '密室逃脫店', '劇場'],
    },
    nature: {
      label: '自然天氣',
      pairs: [['下雨', '下雪'], ['太陽', '月亮'], ['彩虹', '極光'], ['海', '湖'], ['山', '丘陵'], ['森林', '草原'], ['沙漠', '海灘'], ['星星', '月亮'], ['颱風', '地震'], ['春天', '秋天'], ['溫泉', '游泳池'], ['瀑布', '噴泉']],
      places: ['海邊', '山上', '森林遊樂區', '露營區', '國家公園', '溫泉', '瀑布', '農場'],
    },
    school: {
      label: '學校',
      pairs: [['考試', '測驗'], ['老師', '校長'], ['同學', '同事'], ['圖書館', '書局'], ['暑假', '寒假'], ['補習班', '家教'], ['制服', '便服'], ['黑板', '白板'], ['鉛筆', '原子筆'], ['書包', '行李箱'], ['學校', '監獄'], ['作業', '考卷']],
      places: ['學校', '圖書館', '補習班', '書局', '教室', '操場', '博物館', '文具店'],
    },
    health: {
      label: '健康',
      pairs: [['感冒', '發燒'], ['跑步', '健走'], ['減肥', '健身'], ['牙醫', '眼科'], ['打針', '吃藥'], ['住院', '看診'], ['頭痛', '肚子痛'], ['心跳', '呼吸'], ['口罩', '手套'], ['維他命', '保健食品'], ['量體溫', '量血壓'], ['針灸', '按摩']],
      places: ['醫院', '診所', '藥局', '健身房', '公園', '游泳池', '牙醫診所', '保健食品店'],
    },
  };
  const spySync = {
    mode: 'local',      // 'local' | 'host' | 'client'
    solo: false,        // 離線單機：不連 PeerJS、不發 QR,輪流傳手機
    code: '',
    peer: null,
    conns: [],
    conn: null,
    mySlot: 0,
    ready: false,
    config: null,       // { mode, word, spyWord, minutes, voice, spyCount }
    players: [],        // [{ name, isSpy, joined, ready, voted, online }]
    steps: [],
    stepIndex: -1,
    votes: {},          // voterSlot -> targetSlot (null = abstain)
    over: null,         // { camp: 'village'|'spy', votedSlot, counts }
    timerLeft: 0,
    timerInterval: null,
    myWord: null,       // client only: my own word
  };
  const spySetupPanel = $('#spySetup');
  const spyHostPanel = $('#spyHost');
  const spyClientPanel = $('#spyClient');
  const spyBadge = $('#spyBadge');
  const spyCustomToggle = $('#spyCustomToggle');
  const spyCount = $('#spyCount');
  const spySpies = $('#spySpies');
  const spyMinutes = $('#spyMinutes');
  const spyCustom = $('#spyCustom');
  const spyCustomWord = $('#spyCustomWord');
  const spyCustomSpyWord = $('#spyCustomSpyWord');
  const spyVoiceToggle = $('#spyVoiceToggle');
  const spyStatus = $('#spyStatus');
  const spyQrGrid = $('#spyQrGrid');
  const spyRoster = $('#spyRoster');
  const spyControl = $('#spyControl');
  const spyPhaseLabel = $('#spyPhaseLabel');
  const spyPhaseTitle = $('#spyPhaseTitle');
  const spyPhaseHint = $('#spyPhaseHint');
  const spyPhaseActions = $('#spyPhaseActions');
  const spyNextButton = $('#spyNextButton');
  const endSpyRoomButton = $('#endSpyRoomButton');
  const spyClientStatus = $('#spyClientStatus');
  const spyClientBody = $('#spyClientBody');
  // 離線單機狀態:發詞進度、收票進度與預先填好的玩家名字。
  let spySoloDeal = { slot: 0, peeked: false };
  let spySoloVote = { idx: 0 };
  let spySoloNamesDraft = [];
  function resetSpySoloState() {
    spySoloDeal = { slot: 0, peeked: false };
    spySoloVote = { idx: 0 };
  }

  // 離線單機:開局前把所有玩家的名字一次填好,傳手機時就不必再輸入。
  function renderSpySoloNameList() {
    const list = $('#spySoloNameList');
    if (!list) return;
    const count = clamp(Number(spyCount.value) || 6, 4, 12);
    list.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement('label');
      row.className = 'participant-input-row';
      const number = document.createElement('span');
      number.className = 'participant-number';
      number.textContent = pad(index + 1);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.className = 'spy-solo-name-input';
      input.value = typeof spySoloNamesDraft[index] === 'string' ? spySoloNamesDraft[index] : '';
      input.placeholder = `玩家 ${index + 1}`;
      input.dataset.spyNameIndex = String(index);
      input.setAttribute('aria-label', `第 ${index + 1} 位玩家名字`);
      input.addEventListener('input', () => { spySoloNamesDraft[index] = input.value; });
      row.append(number, input);
      list.appendChild(row);
    }
  }

  function spySpeak(text) {
    if (!globalVoice || !spySync.config || !spySync.config.voice) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95;
      synth.speak(utterance);
    } catch (error) { /* voice is optional */ }
  }

  function spyBuildSteps() {
    const minutes = Number(spySync.config.minutes) || 3;
    return [
      { id: 'reveal', label: '發詞', title: '查看你的詞', hint: '每個人記住自己的詞後按「看完了」。', secs: 0, voice: '每人查看自己手機上的詞,記住後按看完了。' },
      { id: 'discuss', label: '討論', title: '討論時間', hint: '輪流描述自己的詞,找出破綻。', secs: minutes * 60, timer: true, voice: '討論開始,請用問題和描述找出臥底。' },
      { id: 'vote', label: '投票', title: '投票指認', hint: '投給你認為是臥底的人。', secs: 0, voice: '請投票,指認你認為是臥底的人。' },
      { id: 'result', label: '揭曉', title: '揭曉答案', hint: '', secs: 0, voice: '揭曉答案。' },
    ];
  }

  // 從全部主題的詞裡挑一個跟平民詞無關的詞,給「亂入詞」型的臥底用。
  function spyRandomForeignWord(word) {
    const allWords = [];
    const banned = new Set([word]);
    Object.keys(SPY_THEMES).forEach((themeId) => {
      (SPY_THEMES[themeId].pairs || []).forEach((pair) => {
        pair.forEach((entry) => {
          if (typeof entry === 'string' && entry) allWords.push(entry);
        });
        if (pair.includes(word)) pair.forEach((entry) => banned.add(entry));
      });
    });
    const pool = allWords.filter((entry) => !banned.has(entry));
    if (!pool.length) return allWords.find((entry) => entry !== word) || word;
    return pool[randomInt(pool.length)];
  }

  function createSpyRoom() {
    if (spySync.mode !== 'local') return;
    const solo = spySoloWanted();
    if (!solo && typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      return;
    }
    const count = clamp(Number(spyCount.value) || 6, 4, 12);
    const spyTotal = clamp(Number(spySpies.value) || 1, 1, 2);
    if (spyTotal >= count) { showToast('臥底人數要比玩家人數少'); return; }
    const customWanted = spyCustomToggle.checked;
    // 詞組主題與種類都由系統在後台祕密決定(自訂詞組除外),不對任何人透露。
    const presetThemeIds = Object.keys(SPY_THEMES);
    const themeId = customWanted ? 'custom' : presetThemeIds[randomInt(presetThemeIds.length)];
    let mode = '';
    let word = '';
    let spyWord = '';
    if (themeId === 'custom') {
      mode = 'custom';
      word = spyCustomWord.value.trim().slice(0, 12);
      if (!word) { showToast('請輸入平民詞'); return; }
      spyWord = spyCustomSpyWord.value.trim().slice(0, 12);
      if (!spyWord) spyWord = spyRandomForeignWord(word);
    } else {
      const theme = SPY_THEMES[themeId] || SPY_THEMES.party;
      // 種類由系統在後台隨機決定,不對任何人透露:
      // 'undercover' = 臥底拿到相似詞;'spyfall' = 臥底拿到完全無關的亂入詞。
      mode = Math.random() < 0.6 ? 'undercover' : 'spyfall';
      const pick = theme.pairs[randomInt(theme.pairs.length)];
      word = pick[0];
      spyWord = mode === 'undercover' ? pick[1] : spyRandomForeignWord(word);
    }
    const code = makeRoomCode();
    const spySlots = new Set();
    while (spySlots.size < spyTotal) spySlots.add(randomInt(count));
    spySync.solo = solo;
    resetSpySoloState();
    spySync.code = code;
    spySync.mySlot = 0;
    spySync.conns = [];
    spySync.config = { mode, word, spyWord, minutes: Number(spyMinutes.value) || 3, voice: spyVoiceToggle.checked, spyCount: spyTotal, theme: themeId };
    spySync.players = Array.from({ length: count }, (_, index) => ({
      name: (solo ? (spySoloNamesDraft[index] || '').trim().slice(0, 14) : '') || `玩家 ${index + 1}`,
      isSpy: spySlots.has(index),
      joined: solo || index === 0,
      ready: false,
      voted: false,
      online: solo || index === 0,
    }));
    spySync.steps = spyBuildSteps();
    spySync.stepIndex = 0;
    spySync.votes = {};
    spySync.over = null;
    spySync.myWord = null;
    spySetMode('host');
    if (solo) {
      spyBadge.textContent = '離線單機';
      spyUpdateStatus('離線單機 · 免網路、免 QR,輪流傳手機看詞;螢幕保持常亮');
      soloKeepScreenAwake();
      spyQrGrid.hidden = true;
      spyEnterStep();
      return;
    }
    spyBadge.textContent = '房主';
    spyUpdateStatus('建立中…');
    spyQrGrid.hidden = true;
    spyPeerCreate(`${SPY_HOST_PREFIX}${code.toLowerCase()}`);
    spyEnterStep();
  }

  function spyPeerCreate(hostId) {
    const peer = new Peer(hostId, { debug: 1 });
    spySync.peer = peer;
    peer.on('open', () => {
      spySync.ready = true;
      spyUpdateStatus(`房間代號 ${spySync.code} · 等大家掃 QR 加入`);
      renderSpyQrGrid();
      renderSpyHostView();
    });
    peer.on('connection', (conn) => setupSpyHostConnection(conn));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突,請重試'); resetSpySync(); }
      else if (type === 'invalid-id') { showToast('連線設定錯誤'); resetSpySync(); }
      else showToast('連線暫時不穩,仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function renderSpyQrGrid() {
    spyQrGrid.replaceChildren();
    if (typeof qrcode !== 'function') {
      spyQrGrid.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    for (let slot = 1; slot < spySync.players.length; slot += 1) {
      const url = `${base}?${new URLSearchParams({ spy: spySync.code, p: String(slot) }).toString()}`;
      spyQrGrid.appendChild(buildQrCard(slot, url, '掃描後設定名字,再查看你的詞'));
    }
    spyQrGrid.hidden = false;
  }

  function makeSpyClientId(code, slot) {
    return `${SPY_HOST_PREFIX}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function joinSpyRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      spySetMode('local');
      return;
    }
    spySync.code = code;
    spySync.mySlot = slot;
    spySync.conns = [];
    spySync.players = [];
    spySetMode('client');
    spyClientUpdateStatus(`正在連線「${code}」…`);
    const peer = new Peer(makeSpyClientId(code, slot), { debug: 1 });
    spySync.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${SPY_HOST_PREFIX}${code.toLowerCase()}`, { reliable: true });
      spySync.conn = conn;
      conn.on('open', () => {
        conn.send({ type: 'hello', slot, name: `玩家 ${slot + 1}` });
      });
      conn.on('data', (message) => { try { handleSpyClientMessage(message); } catch (error) { /* ignore */ } });
      conn.on('close', () => spyClientUpdateStatus('已中斷連線,請重新掃描 QR'));
      conn.on('error', () => spyClientUpdateStatus('連線中斷,請重新掃描 QR'));
    });
    peer.on('error', () => {
      showToast('連線失敗,請確認網路');
      spyClientUpdateStatus('連線失敗,請確認網路後重新掃描');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function setupSpyHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { handleSpyHostMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => removeSpyHostConn(conn));
    conn.on('error', () => removeSpyHostConn(conn));
  }

  function handleSpyHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 1), 0, spySync.players.length - 1);
      if (!spySync.players[slot]) return;
      spySync.players[slot].joined = true;
      spySync.players[slot].online = true;
      spySync.conns.push({ conn, slot });
      const joined = spySync.players.filter((player) => player.joined).length;
      spyUpdateStatus(`房間代號 ${spySync.code} · 已加入 ${joined}/${spySync.players.length} 人`);
      broadcastSpyState();
    } else if (message.type === 'ready') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, spySync.players.length - 1);
      if (spySync.players[slot]) {
        spySync.players[slot].ready = true;
        broadcastSpyState();
      }
    } else if (message.type === 'name') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, spySync.players.length - 1);
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${slot + 1}`;
      if (spySync.players[slot]) {
        const oldName = spySync.players[slot].name;
        spySync.players[slot].name = name;
        if (oldName !== name) showToast(`${oldName} 改名為 ${name}`);
        broadcastSpyState();
      }
    } else if (message.type === 'vote') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, spySync.players.length - 1);
      if (!spySync.players[slot]) return;
      if (message.target === null || message.target === undefined) {
        spySync.votes[slot] = null;
      } else {
        spySync.votes[slot] = clamp(Math.floor(Number(message.target)), 0, spySync.players.length - 1);
      }
      spySync.players[slot].voted = true;
      broadcastSpyState();
    }
  }

  function removeSpyHostConn(conn) {
    const before = spySync.conns.length;
    const removed = spySync.conns.find((entry) => entry.conn === conn);
    spySync.conns = spySync.conns.filter((entry) => entry.conn !== conn);
    if (removed && spySync.players[removed.slot]) spySync.players[removed.slot].online = false;
    if (spySync.conns.length !== before) {
      const joined = spySync.players.filter((player) => player.joined).length;
      spyUpdateStatus(`房間代號 ${spySync.code} · 已加入 ${joined}/${spySync.players.length} 人`);
      broadcastSpyState();
    }
  }

  function resetSpySync() {
    if (spySync.timerInterval) { window.clearInterval(spySync.timerInterval); spySync.timerInterval = null; }
    try { if (spySync.peer) spySync.peer.destroy(); } catch (error) { /* ignore */ }
    spySync.mode = 'local';
    spySync.code = '';
    spySync.peer = null;
    spySync.conns = [];
    spySync.conn = null;
    spySync.mySlot = 0;
    spySync.ready = false;
    spySync.config = null;
    spySync.players = [];
    spySync.steps = [];
    spySync.stepIndex = -1;
    spySync.votes = {};
    spySync.over = null;
    spySync.timerLeft = 0;
    spySync.myWord = null;
    if (spySync.solo) soloAllowScreenSleep();
    spySync.solo = false;
    resetSpySoloState();
    spyBadge.textContent = '房主';
    spySetMode('local');
  }

  function spySetMode(mode) {
    spySync.mode = mode;
    const connected = mode !== 'local';
    spySetupPanel.hidden = connected;
    spyHostPanel.hidden = mode !== 'host';
    spyClientPanel.hidden = mode !== 'client';
    endSpyRoomButton.hidden = !connected;
    spyNextButton.hidden = mode !== 'host';
    if (!connected) {
      spyStatus.hidden = true;
      spyQrGrid.hidden = true;
      spyControl.hidden = true;
      spyPhaseActions.replaceChildren();
      spyPhaseLabel.textContent = '準備中';
      spyPhaseTitle.textContent = '等大家加入';
      spyPhaseHint.textContent = '';
      spyClientStatus.textContent = '尚未加入房間';
    } else {
      spyControl.hidden = mode !== 'host';
      if (mode === 'client') spyQrGrid.hidden = true;
      if (mode === 'host') renderSpyHostView();
      if (mode === 'client') renderSpyClient();
    }
  }

  function spyUpdateStatus(text) {
    if (spySync.mode === 'host') {
      spyStatus.textContent = text;
      spyStatus.hidden = false;
    }
  }

  function spyClientUpdateStatus(text) {
    spyClientStatus.textContent = text;
  }

  function sendToSpyHost(message) {
    if (spySync.conn && spySync.conn.open) {
      try { spySync.conn.send(message); } catch (error) { /* ignore */ }
    } else {
      showToast('尚未連上主持人');
    }
  }

  function broadcastSpyState() {
    const payload = {
      type: 'state',
      players: spySync.players.map((player) => ({
        name: player.name,
        isSpy: player.isSpy,
        joined: player.joined,
        ready: player.ready,
        voted: player.voted,
        online: player.online !== false,
      })),
      stepIndex: spySync.stepIndex,
      steps: spySync.steps.map((step) => ({
        id: step.id, label: step.label, title: step.title, hint: step.hint, timer: Boolean(step.timer),
      })),
      votes: { ...spySync.votes },
      over: spySync.over,
      timerLeft: spySync.timerLeft,
      myWord: null,
    };
    spySync.conns.forEach(({ conn, slot }) => {
      const me = spySync.players[slot] || {};
      const myCopy = JSON.parse(JSON.stringify(payload));
      // Spy status is secret: only your own is visible (and never announced).
      myCopy.players = myCopy.players.map((player, index) => (
        index === slot ? player : { ...player, isSpy: null }
      ));
      // Your own word only: everyone (including the spy) just gets a word.
      if (spySync.config) {
        myCopy.myWord = me.isSpy ? (spySync.config.spyWord || spySync.config.word) : spySync.config.word;
      }
      try { conn.send(myCopy); } catch (error) { /* ignore */ }
    });
    renderSpyHostView();
  }

  function handleSpyClientMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'tick' && Number.isFinite(message.left)) {
      spySync.timerLeft = Math.max(0, Number(message.left));
      const step = spySync.steps[spySync.stepIndex] || null;
      if (step && step.id === 'discuss') renderSpyClient();
      return;
    }
    if (message.type === 'state' && Array.isArray(message.players)) {
      spySync.players = message.players.map((player) => ({
        name: validString(player.name, '玩家').trim().slice(0, 14) || '玩家',
        isSpy: player.isSpy === true,
        joined: Boolean(player.joined),
        ready: Boolean(player.ready),
        voted: Boolean(player.voted),
        online: player.online !== false,
      }));
      spySync.steps = message.steps || [];
      spySync.stepIndex = message.stepIndex || 0;
      spySync.votes = message.votes || {};
      spySync.over = message.over || null;
      spySync.timerLeft = message.timerLeft || 0;
      spySync.myWord = validString(message.myWord, '').trim() || null;
      spySync.ready = true;
      spyClientUpdateStatus(`已連線 · 玩家 ${spySync.mySlot + 1}`);
      renderSpyClient();
    }
  }

  function spyResolveResult() {
    const counts = {};
    Object.keys(spySync.votes).forEach((key) => {
      const target = spySync.votes[key];
      if (target !== null && target !== undefined && Number.isInteger(target)) {
        counts[target] = (counts[target] || 0) + 1;
      }
    });
    let top = null;
    let topCount = 0;
    let tie = false;
    Object.keys(counts).forEach((key) => {
      const slot = Number(key);
      if (counts[slot] > topCount) { top = slot; topCount = counts[slot]; tie = false; }
      else if (counts[slot] === topCount) tie = true;
    });
    if (tie) top = null;
    const spySlots = spySync.players.map((player, index) => (player.isSpy ? index : -1)).filter((index) => index >= 0);
    const villageWin = top !== null && spySlots.includes(top);
    spySync.over = { camp: villageWin ? 'village' : 'spy', votedSlot: top, counts };
  }

  function spyAdvance() {
    spySync.stepIndex += 1;
    spyEnterStep();
  }

  // 離線單機時的標題/提示文案。
  function spySoloStepCopy(step) {
    if (!spySync.solo || !step) return null;
    if (step.id === 'reveal') {
      return { title: '傳手機發詞', hint: '把手機輪流傳給每位玩家:看自己的詞、記住,蓋牌後傳下一位。' };
    }
    if (step.id === 'vote') {
      return { title: '投票 · 主持人代投', hint: '輪到的玩家用手指比人,主持人點黑卡收票;收齊後自動揭曉。' };
    }
    return null;
  }

  function spyEnterStep() {
    const step = spySync.steps[spySync.stepIndex];
    if (!step) return;
    if (step.id === 'vote') {
      spySync.votes = {};
      spySoloVote = { idx: 0 };
    }
    if (step.id === 'result') spyResolveResult();
    spySync.players.forEach((player) => {
      player.ready = false;
      player.voted = false;
    });
    if (spySync.mode === 'host') {
      const copy = spySoloStepCopy(step);
      spyPhaseLabel.textContent = step.label || '';
      spyPhaseTitle.textContent = copy && copy.title ? copy.title : (step.title || '');
      renderSpyPhaseHint();
      renderSpyHostView();
      if (spySync.timerInterval) { window.clearInterval(spySync.timerInterval); spySync.timerInterval = null; }
      spySync.timerLeft = step.timer ? step.secs : 0;
      if (step.timer) {
        spySync.timerInterval = window.setInterval(() => {
          spySync.timerLeft = Math.max(0, spySync.timerLeft - 1);
          renderSpyPhaseHint();
          spySync.conns.forEach(({ conn }) => {
            try { conn.send({ type: 'tick', left: spySync.timerLeft }); } catch (error) { /* ignore */ }
          });
          if (spySync.timerLeft === 0) {
            window.clearInterval(spySync.timerInterval);
            spySync.timerInterval = null;
            spySpeak('時間到,請開始投票。');
            showToast('時間到,請開始投票');
            vibrate([60, 40, 90]);
          }
        }, 1000);
        renderSpyPhaseHint();
      }
      spySpeak(step.voice || '');
    } else {
      renderSpyClient();
    }
    broadcastSpyState();
  }

  function renderSpyPhaseHint() {
    const step = spySync.steps[spySync.stepIndex] || null;
    if (!step) return;
    const copy = spySync.mode === 'host' ? spySoloStepCopy(step) : null;
    let text = (copy && copy.hint) || step.hint || '';
    if (step.timer) {
      const minutes = Math.floor(spySync.timerLeft / 60);
      const seconds = spySync.timerLeft % 60;
      text += `（${pad(minutes)}:${pad(seconds)}）`;
    }
    spyPhaseHint.textContent = text;
    spyPhaseHint.classList.toggle('wolf-timer', step.timer);
  }

  function renderSpyRoster() {
    spyRoster.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'list-heading';
    const left = document.createElement('span');
    const step = spySync.steps[spySync.stepIndex] || null;
    const stepId = step ? step.id : '';
    const confirmed = spySync.players.filter((player) => player.ready).length;
    const voted = spySync.players.filter((player) => player.voted).length;
    let stateText = '';
    if (stepId === 'vote') stateText = `· 已投票 ${voted}/${spySync.players.length}`;
    else if (stepId === 'reveal') stateText = `· 已確認 ${confirmed}/${spySync.players.length}`;
    left.textContent = `玩家狀態${stateText}`;
    heading.appendChild(left);
    spyRoster.appendChild(heading);
    spySync.players.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'wolf-player' + (player.online === false ? ' is-dead' : '');
      const rank = document.createElement('span');
      rank.className = 'wolf-player-rank';
      rank.textContent = pad(index + 1);
      const name = document.createElement('strong');
      name.className = 'wolf-player-name';
      name.textContent = player.name + (player.online === false ? '（離線）' : '');
      const status = document.createElement('span');
      status.className = 'wolf-player-role';
      if (stepId === 'vote') status.textContent = player.voted ? '✅ 已投票' : (player.joined ? '未投票' : '未加入');
      else if (stepId === 'discuss') status.textContent = player.joined ? '🗣️ 討論中' : '未加入';
      else if (stepId === 'reveal') status.textContent = player.ready ? '✅ 已確認' : (player.joined ? '看詞中' : '未加入');
      else status.textContent = player.joined ? '已加入' : '未加入';
      row.append(rank, name, status);
      spyRoster.appendChild(row);
    });
  }

  function spyNextLabel(step) {
    if (!step) return '下一步 <span>↗</span>';
    if (step.id === 'reveal') return '開始討論 <span>🗣️</span>';
    if (step.id === 'discuss') return '提早收票,開始投票 <span>🗳️</span>';
    if (step.id === 'vote') return '揭曉答案 <span>🎬</span>';
    return '下一步 <span>↗</span>';
  }

  // ---- 離線單機:傳手機發詞 ----
  function spySoloDealUI() {
    const total = spySync.players.length;
    const dealt = Math.min(spySoloDeal.slot, total);
    if (dealt >= total) {
      spyPhaseActions.appendChild(soloProgressNote(`✅ ${total} 人都看過詞了,手機交回主持人。`));
      return;
    }
    const player = spySync.players[dealt];
    if (!spySoloDeal.peeked) {
      spyPhaseActions.appendChild(soloProgressNote(`傳手機發詞 · 第 ${dealt + 1}/${total} 位`));
      const card = soloHandoffCard('請把手機交給', `${pad(dealt + 1)} ${player.name}`, '本人拿起手機後,點這張黑牌看詞');
      card.addEventListener('click', () => {
        spySoloDeal.peeked = true;
        renderSpyPhaseActions();
      });
      spyPhaseActions.appendChild(card);
      return;
    }
    const card = document.createElement('div');
    card.className = 'game-word-card';
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    const word = document.createElement('strong');
    const sub = document.createElement('p');
    sub.className = 'role-desc';
    // 每個人都只看到自己的詞,臥底不會被標示、也不會被通知。
    label.textContent = `${player.name} · 你的詞`;
    word.textContent = player.isSpy === true ? spySync.config.spyWord : spySync.config.word;
    sub.textContent = '記住你的詞,討論時不要直接講出關鍵字。';
    card.append(label, word, sub);
    spyPhaseActions.appendChild(card);
    const action = document.createElement('div');
    action.className = 'wolf-action';
    const done = document.createElement('button');
    done.className = 'button button-primary button-large';
    done.type = 'button';
    done.innerHTML = dealt + 1 >= total ? '記住了,交回主持人 <span>▣</span>' : '記住了,蓋牌給下一位 <span>▣</span>';
    done.addEventListener('click', () => {
      player.ready = true;
      spySoloDeal.slot = dealt + 1;
      spySoloDeal.peeked = false;
      renderSpyPhaseActions();
      renderSpyRoster();
    });
    action.appendChild(done);
    spyPhaseActions.appendChild(action);
  }

  // ---- 離線單機:投票(玩家指人,主持人點黑卡) ----
  function spySoloVoteUI() {
    const voters = spySync.players.map((player, slot) => ({ ...player, slot }));
    const collected = voters.filter((player) => spySync.votes[player.slot] !== undefined).length;
    spyPhaseActions.appendChild(soloProgressNote(`主持人代投 · 已收 ${collected}/${voters.length} 票`));
    if (spySoloVote.idx >= voters.length) {
      const reveal = document.createElement('button');
      reveal.className = 'button button-secondary';
      reveal.type = 'button';
      reveal.innerHTML = '揭曉答案 <span>🎬</span>';
      reveal.addEventListener('click', () => spyAdvance());
      spyPhaseActions.appendChild(reveal);
      return true;
    }
    const voter = voters[spySoloVote.idx];
    const who = document.createElement('p');
    who.className = 'solo-vote-who';
    who.textContent = `現在投票：${pad(voter.slot + 1)} ${voter.name} — 用手指比,主持人點卡`;
    spyPhaseActions.appendChild(who);
    const entries = voters.filter((player) => player.slot !== voter.slot);
    spyPhaseActions.appendChild(soloCardGrid(entries, {
      selectedSlot: spySync.votes[voter.slot],
      onPick: (entry) => {
        spySync.votes[voter.slot] = entry.slot;
        spySync.players[voter.slot].voted = true;
        spySoloVote.idx += 1;
        renderSpyPhaseActions();
      },
    }));
    const row = document.createElement('div');
    row.className = 'solo-row';
    const abstain = wolfOptionButton('這票棄權', () => {
      spySync.votes[voter.slot] = null;
      spySync.players[voter.slot].voted = true;
      spySoloVote.idx += 1;
      renderSpyPhaseActions();
    });
    const redo = wolfOptionButton('↩︎ 重收上一票', () => {
      if (spySoloVote.idx > 0) {
        spySoloVote.idx -= 1;
        const prev = voters[spySoloVote.idx];
        if (prev) {
          delete spySync.votes[prev.slot];
          spySync.players[prev.slot].voted = false;
        }
        renderSpyPhaseActions();
      }
    });
    redo.disabled = spySoloVote.idx === 0;
    row.append(abstain, redo);
    spyPhaseActions.appendChild(row);
    return false;
  }

  // 線上模式的主持人也是玩家:看詞與投票和大家一樣,但同樣不會被告知是否為臥底。
  function spyHostWordUI() {
    const me = spySync.players[0];
    if (!me) return;
    const card = document.createElement('div');
    card.className = 'game-word-card';
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    label.textContent = '你的詞';
    const word = document.createElement('strong');
    word.textContent = me.isSpy === true ? spySync.config.spyWord : spySync.config.word;
    const sub = document.createElement('p');
    sub.className = 'role-desc';
    sub.textContent = '記住你的詞,討論時不要直接講出關鍵字。';
    card.append(label, word, sub);
    spyPhaseActions.appendChild(card);
    const action = document.createElement('div');
    action.className = 'wolf-action';
    const done = document.createElement('button');
    done.className = 'button button-primary button-large';
    done.type = 'button';
    if (me.ready) {
      done.textContent = '已確認 ✅';
      done.disabled = true;
    } else {
      done.innerHTML = '記住了,蓋牌 <span>▣</span>';
      done.addEventListener('click', () => {
        me.ready = true;
        renderSpyPhaseActions();
        renderSpyRoster();
      });
    }
    action.appendChild(done);
    spyPhaseActions.appendChild(action);
  }

  function spyHostVoteUI() {
    const wrap = document.createElement('div');
    wrap.className = 'wolf-action';
    const heading = document.createElement('h5');
    heading.textContent = '你的這一票:誰是臥底?';
    wrap.appendChild(heading);
    spyPhaseActions.appendChild(wrap);
    const list = document.createElement('div');
    list.className = 'wolf-target-list';
    spySync.players.forEach((player, index) => {
      if (index === 0) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wolf-target' + (spySync.votes[0] === index ? ' is-selected' : '');
      const rank = document.createElement('span');
      rank.className = 'wolf-target-rank';
      rank.textContent = pad(index + 1);
      const name = document.createElement('span');
      name.className = 'wolf-target-name';
      name.textContent = player.name;
      button.append(rank, name);
      button.addEventListener('click', () => {
        spySync.votes[0] = index;
        spySync.players[0].voted = true;
        renderSpyPhaseActions();
        renderSpyRoster();
      });
      list.appendChild(button);
    });
    const abstain = wolfOptionButton('棄權', () => {
      spySync.votes[0] = null;
      spySync.players[0].voted = true;
      renderSpyPhaseActions();
      renderSpyRoster();
    }, spySync.votes[0] === null);
    list.appendChild(abstain);
    spyPhaseActions.appendChild(list);
  }

  function renderSpyPhaseActions() {
    spyPhaseActions.replaceChildren();
    const step = spySync.steps[spySync.stepIndex] || null;
    if (!step) return;
    const solo = spySync.solo === true;
    let hideNext = false;
    if (step.id === 'result' && spySync.over) {
      const banner = document.createElement('div');
      banner.className = 'wolf-winner';
      banner.textContent = spySync.over.camp === 'village' ? '🧑‍🤝‍🧑 平民獲勝' : '🕵️ 臥底獲勝';
      spyPhaseActions.appendChild(banner);
      const detail = document.createElement('p');
      detail.className = 'wolf-custom-summary';
      const spySlots = spySync.players.map((player, index) => (player.isSpy ? index : -1)).filter((index) => index >= 0);
      const spyNames = spySlots.map((index) => spySync.players[index].name).join('、');
      const voted = Number.isInteger(spySync.over.votedSlot) ? spySync.players[spySync.over.votedSlot].name : '無人（平票或全棄權）';
      detail.textContent = `臥底是 ${spyNames}。被投出的是 ${voted}。`;
      spyPhaseActions.appendChild(detail);
      if (spySync.config) {
        const words = document.createElement('p');
        words.className = 'wolf-custom-summary';
        words.textContent = `平民詞「${spySync.config.word}」 / 臥底詞「${spySync.config.spyWord}」`;
        spyPhaseActions.appendChild(words);
        const kind = document.createElement('p');
        kind.className = 'wolf-custom-summary';
        kind.textContent = spySync.config.mode === 'custom'
          ? '本局種類:自訂詞(主持人設定的詞)'
          : spySync.config.mode === 'undercover'
            ? '本局種類:相似詞(臥底拿到的是相似詞)'
            : '本局種類:亂入詞(臥底拿到的是完全無關的詞)';
        spyPhaseActions.appendChild(kind);
        const themeLine = document.createElement('p');
        themeLine.className = 'wolf-custom-summary';
        themeLine.textContent = spySync.config.theme === 'custom'
          ? '本局主題:自訂詞(主持人出題)'
          : `本局主題:${(SPY_THEMES[spySync.config.theme] || {}).label || '未知'}(系統祕密決定)`;
        spyPhaseActions.appendChild(themeLine);
      }
      spyNextButton.hidden = true;
      return;
    }
    if (step.id === 'vote') {
      if (solo) {
        hideNext = !spySoloVoteUI();
      } else {
        const voted = spySync.players.filter((player) => player.voted).length;
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = `已投票 ${voted}/${spySync.players.length} 人。`;
        spyPhaseActions.appendChild(note);
        spyHostVoteUI();
      }
    } else if (step.id === 'reveal') {
      if (solo) {
        spySoloDealUI();
        hideNext = spySoloDeal.slot < spySync.players.length;
      } else {
        const confirmed = spySync.players.filter((player) => player.ready).length;
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = `已確認 ${confirmed}/${spySync.players.length} 人。`;
        spyPhaseActions.appendChild(note);
        spyHostWordUI();
      }
    }
    if (step.id === 'discuss' && !solo) {
      const me = spySync.players[0];
      if (me) {
        const word = me.isSpy === true ? spySync.config.spyWord : spySync.config.word;
        spyPhaseActions.appendChild(spyWordCard(word));
      }
    }
    spyNextButton.hidden = hideNext;
    spyNextButton.innerHTML = spyNextLabel(step);
  }

  function renderSpyHostView() {
    if (spySync.mode !== 'host') return;
    renderSpyPhaseActions();
    renderSpyRoster();
  }

  function spyNameEditor() {
    const me = spySync.players[spySync.mySlot];
    const wrap = document.createElement('div');
    if (!me) return wrap;
    wrap.className = 'wolf-action';
    const labelEl = document.createElement('h5');
    labelEl.textContent = '顯示名稱（主持人靠這個認人）';
    const nameInput = document.createElement('input');
    nameInput.className = 'sync-my-name';
    nameInput.type = 'text';
    nameInput.maxLength = 14;
    nameInput.value = me.name;
    nameInput.setAttribute('aria-label', '我的顯示名稱');
    nameInput.addEventListener('change', () => {
      const value = nameInput.value.trim().slice(0, 14) || `玩家 ${spySync.mySlot + 1}`;
      spySync.players[spySync.mySlot].name = value;
      sendToSpyHost({ type: 'name', slot: spySync.mySlot, name: value });
      renderSpyClient();
    });
    wrap.append(labelEl, nameInput);
    return wrap;
  }

  function spyWordCard(myWord = spySync.myWord) {
    const card = document.createElement('div');
    card.className = 'game-word-card is-hidden';
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    const word = document.createElement('strong');
    label.textContent = '點一下偷看你的詞';
    word.textContent = myWord || '…';
    card.append(label, word);
    card.addEventListener('click', () => card.classList.toggle('is-hidden'));
    return card;
  }

  function renderSpyClient() {
    if (spySync.mode !== 'client') return;
    spyClientBody.replaceChildren();
    const me = spySync.players[spySync.mySlot];
    if (!me) {
      const p = document.createElement('p');
      p.className = 'wolf-custom-summary';
      p.textContent = '等待主持人同步資料…';
      spyClientBody.appendChild(p);
      return;
    }
    const isSpy = me.isSpy === true;
    const step = spySync.steps[spySync.stepIndex] || null;

    // Result screen.
    if (spySync.over && step && step.id === 'result') {
      const reveal = document.createElement('div');
      reveal.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = spySync.over.camp === 'village' ? '🧑‍🤝‍🧑' : '🕵️';
      const title = document.createElement('strong');
      title.textContent = spySync.over.camp === 'village' ? '平民獲勝' : '臥底獲勝';
      const spySlots = spySync.players.map((player, index) => (player.isSpy ? index : -1)).filter((index) => index >= 0);
      const spyNames = spySlots.map((index) => spySync.players[index].name).join('、');
      const voted = Number.isInteger(spySync.over.votedSlot) ? spySync.players[spySync.over.votedSlot].name : '無人（平票或全棄權）';
      const p1 = document.createElement('p');
      p1.className = 'role-desc';
      p1.textContent = `臥底是 ${spyNames}`;
      const p2 = document.createElement('p');
      p2.className = 'role-desc';
      p2.textContent = `被投出的是 ${voted}`;
      const p3 = document.createElement('p');
      p3.className = 'role-desc';
      const iWon = (spySync.over.camp === 'village') !== isSpy;
      p3.textContent = iWon ? '🎉 你贏了!' : '你輸了,下局再加油!';
      const roleLine = document.createElement('p');
      roleLine.className = 'role-desc';
      roleLine.textContent = isSpy ? '你的身份是 🕵️ 臥底' : `你的詞是「${spySync.myWord || '？'}」`;
      reveal.append(emoji, title, p1, p2, p3, roleLine);
      spyClientBody.appendChild(reveal);
      return;
    }
    if (!step) return;

    if (step.id === 'reveal') {
      const card = document.createElement('div');
      card.className = 'game-word-card';
      const label = document.createElement('span');
      label.className = 'wolf-phase-label';
      // 每個人都只看到自己的詞;臥底不會被標示,也不會被通知。
      label.textContent = '你的詞';
      const word = document.createElement('strong');
      word.textContent = spySync.myWord || '…';
      const sub = document.createElement('p');
      sub.className = 'role-desc';
      sub.textContent = '記住你的詞,討論時不要直接講出關鍵字。';
      card.append(label, word, sub);
      spyClientBody.appendChild(card);
      spyClientBody.appendChild(spyNameEditor());
      spyClientBody.appendChild(buildGameRules('誰是臥底怎麼玩?', [
        '系統在後台祕密決定本局詞組主題、種類(相似詞或亂入詞)與誰是臥底,連臥底自己都不會被通知。',
        '大部分人是同一個詞(平民),少數人拿到另一個詞(臥底),輪流描述自己的詞、不能講關鍵字。',
        '發現自己的詞跟別人不一樣時,就要想辦法混過去;討論結束後手機投票抓臥底。',
        '投中是臥底 → 平民贏;沒抓到 → 臥底贏。揭曉時會公布種類與兩個詞。',
      ]));
      const action = document.createElement('div');
      action.className = 'wolf-action';
      const done = document.createElement('button');
      done.className = 'button button-primary button-large';
      done.type = 'button';
      if (me.ready) {
        done.textContent = '已確認 ✅';
        done.disabled = true;
      } else {
        done.innerHTML = '記住了,蓋牌 <span>▣</span>';
        done.addEventListener('click', () => {
          spySync.players[spySync.mySlot].ready = true;
          sendToSpyHost({ type: 'ready', slot: spySync.mySlot });
          renderSpyClient();
        });
      }
      action.appendChild(done);
      spyClientBody.appendChild(action);
      return;
    }

    if (step.id === 'discuss') {
      const card = document.createElement('div');
      card.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = '🗣️';
      const title = document.createElement('strong');
      title.textContent = '討論中';
      const sub = document.createElement('p');
      sub.className = 'role-desc';
      sub.textContent = '輪流描述自己的詞。點下面的卡片偷看自己的詞,不要被別人看到!';
      card.append(emoji, title, sub);
      spyClientBody.appendChild(card);
      spyClientBody.appendChild(spyWordCard());
      if (spySync.timerLeft > 0) {
        const t = document.createElement('p');
        t.className = 'wolf-custom-summary';
        t.textContent = `剩餘 ${pad(Math.floor(spySync.timerLeft / 60))}:${pad(spySync.timerLeft % 60)}`;
        spyClientBody.appendChild(t);
      }
      return;
    }

    if (step.id === 'vote') {
      const card = document.createElement('div');
      card.className = 'wolf-action';
      const h = document.createElement('h5');
      h.textContent = '投票:誰是臥底?';
      card.appendChild(h);
      spyClientBody.appendChild(card);
      const list = document.createElement('div');
      list.className = 'wolf-target-list';
      spySync.players.forEach((player, index) => {
        if (index === spySync.mySlot) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wolf-target' + (spySync.votes[spySync.mySlot] === index ? ' is-selected' : '');
        const rank = document.createElement('span');
        rank.className = 'wolf-target-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('span');
        name.className = 'wolf-target-name';
        name.textContent = player.name;
        button.append(rank, name);
        button.addEventListener('click', () => {
          sendToSpyHost({ type: 'vote', slot: spySync.mySlot, target: index });
          renderSpyClient();
        });
        list.appendChild(button);
      });
      const abstain = wolfOptionButton('棄權', () => {
        sendToSpyHost({ type: 'vote', slot: spySync.mySlot, target: null });
        renderSpyClient();
      }, spySync.votes[spySync.mySlot] === null);
      list.appendChild(abstain);
      spyClientBody.appendChild(list);
      if (spySync.votes[spySync.mySlot] !== undefined) {
        const done = document.createElement('p');
        done.className = 'wolf-custom-summary';
        done.textContent = '✅ 已投票,可以修改直到主持人揭曉。';
        spyClientBody.appendChild(done);
      }
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = 'wolf-black';
    fallback.textContent = '請稍候…';
    spyClientBody.appendChild(fallback);
  }

  spyCustomToggle.addEventListener('change', () => {
    spyCustom.hidden = !spyCustomToggle.checked;
  });
  spyCount.addEventListener('change', () => {
    if (!$('#spySoloNames').hidden) renderSpySoloNameList();
  });
  $('#createSpyRoomButton').addEventListener('click', createSpyRoom);
  const spySoloWanted = initSoloToggle('spyPlayMode', (solo) => {
    $('#createSpyRoomButton').innerHTML = solo ? '開始離線單機局 <span>📴</span>' : '建立誰是臥底房間 <span>↗</span>';
    $('#spyOnlineCopy').hidden = solo;
    $('#spySoloCopy').hidden = !solo;
    $('#spySoloNames').hidden = !solo;
    if (solo) renderSpySoloNameList();
  });
  endSpyRoomButton.addEventListener('click', () => {
    resetSpySync();
    showToast('已結束遊戲');
  });
  spyVoiceToggle.addEventListener('change', () => {
    if (spySync.config) spySync.config.voice = spyVoiceToggle.checked;
  });
  spyNextButton.addEventListener('click', () => {
    if (spySync.mode !== 'host') return;
    const step = spySync.steps[spySync.stepIndex] || null;
    if (!step || step.id === 'result') return;
    spyAdvance();
  });
  renderSpySoloNameList();
  spySetMode('local');

  // ===== 一夜狼人 (one-night werewolf: role swaps + vote, host + clients via PeerJS) =====
  const ONE_HOST_PREFIX = 'pocket-one-';
  const ONE_ROLES = {
    werewolf: { name: '狼人', emoji: '🐺', camp: 'wolf', desc: '天黑時與其他狼人相認。天亮後別被抓出來。' },
    seer: { name: '預言家', emoji: '🔮', camp: 'village', desc: '可以查看一名玩家的身份牌。' },
    robber: { name: '強盜', emoji: '🦹', camp: 'village', desc: '可以與一名玩家交換身份牌,並偷看自己拿到的新牌。' },
    troublemaker: { name: '搗蛋鬼', emoji: '🌀', camp: 'village', desc: '可以交換另外兩名玩家的身份牌,但不能偷看。' },
    insomniac: { name: '失眠者', emoji: '😴', camp: 'village', desc: '天亮前可以確認自己的身份牌有沒有被換走。' },
    villager: { name: '村民', emoji: '🧑‍🌾', camp: 'village', desc: '沒有特殊能力,靠推理找出狼人。' },
  };
  const ONE_PRESETS = [
    { id: 'mini4', ver: 'A', label: '版本 A · 4 人新手局', desc: '適配 4 人 · 約 8 分鐘 · 狼×1', roles: ['werewolf', 'seer', 'robber', 'villager'] },
    { id: 'base5', ver: 'B', label: '版本 B · 5 人標準局', desc: '適配 5 人 · 約 10 分鐘 · 狼×2', roles: ['werewolf', 'werewolf', 'seer', 'robber', 'villager'] },
    { id: 'pro6', ver: 'C', label: '版本 C · 6 人進階局', desc: '適配 6 人 · 約 12 分鐘 · 狼×2', roles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager'] },
    { id: 'max8', ver: 'D', label: '版本 D · 8 人大師局', desc: '適配 8 人 · 約 15 分鐘 · 狼×3', roles: ['werewolf', 'werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'insomniac', 'villager'] },
  ];
  const oneSync = {
    mode: 'local',      // 'local' | 'host' | 'client'
    solo: false,        // 離線單機：不連 PeerJS、不發 QR,輪流傳手機
    code: '',
    peer: null,
    conns: [],
    conn: null,
    mySlot: 0,
    ready: false,
    config: null,       // { roles, voice }
    players: [],        // [{ name, role, initialRole, joined, ready, acted, voted, online }]
    steps: [],
    stepIndex: -1,
    targets: {},        // seer / rob / swap2
    votes: {},          // voterSlot -> targetSlot (null = abstain)
    over: null,         // { camp: 'village'|'wolf', votedSlot }
    resultForMe: null,  // seer check / robber stole / insomniac self
    wolfMates: [],      // wolves step: fellow wolf slots
    timerLeft: 0,
    timerInterval: null,
  };
  const oneSetupPanel = $('#oneSetup');
  const oneHostPanel = $('#oneHost');
  const oneClientPanel = $('#oneClient');
  const oneBadge = $('#oneBadge');
  const onePresetList = $('#onePresetList');
  const oneCustom = $('#oneCustom');
  const oneVoiceToggle = $('#oneVoiceToggle');
  const oneStatus = $('#oneStatus');
  const oneQrGrid = $('#oneQrGrid');
  const oneRoster = $('#oneRoster');
  const oneControl = $('#oneControl');
  const onePhaseLabel = $('#onePhaseLabel');
  const onePhaseTitle = $('#onePhaseTitle');
  const onePhaseHint = $('#onePhaseHint');
  const onePhaseActions = $('#onePhaseActions');
  const oneNextButton = $('#oneNextButton');
  const endOneRoomButton = $('#endOneRoomButton');
  const oneClientStatus = $('#oneClientStatus');
  const oneClientBody = $('#oneClientBody');
  let oneCustomRoles = [];
  let oneSelectedPreset = null;
  let oneSwapPicks = [];
  // 離線單機狀態:發牌進度、收票進度、搗蛋鬼的兩個點選。
  let oneSoloDeal = { slot: 0, peeked: false };
  let oneSoloVote = { idx: 0 };
  let oneSoloSwapPicks = [];
  function resetOneSoloState() {
    oneSoloDeal = { slot: 0, peeked: false };
    oneSoloVote = { idx: 0 };
    oneSoloSwapPicks = [];
  }

  function oneRoleById(id) {
    return ONE_ROLES[id] || { name: '村民', emoji: '👤', camp: 'village', desc: '' };
  }

  function oneSpeak(text) {
    if (!globalVoice || !oneSync.config || !oneSync.config.voice) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95;
      synth.speak(utterance);
    } catch (error) { /* voice is optional */ }
  }

  function renderOnePresets() {
    onePresetList.replaceChildren();
    ONE_PRESETS.forEach((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wolf-preset' + (index === 0 ? ' is-selected' : '');
      button.dataset.onePreset = preset.id;
      const title = document.createElement('strong');
      title.textContent = preset.label;
      const sub = document.createElement('span');
      sub.textContent = preset.desc;
      button.append(title, sub);
      button.addEventListener('click', () => {
        $$('.wolf-preset', onePresetList).forEach((el) => el.classList.remove('is-selected'));
        button.classList.add('is-selected');
        oneCustomRoles = [...preset.roles];
        oneSelectedPreset = preset;
        renderOneCustom();
      });
      onePresetList.appendChild(button);
    });
    oneCustomRoles = [...ONE_PRESETS[0].roles];
    oneSelectedPreset = ONE_PRESETS[0];
    renderOneCustom();
  }

  function renderOneCustom() {
    oneCustom.replaceChildren();
    oneCustom.hidden = false;
    const step = document.createElement('div');
    step.className = 'wolf-step';
    const stepNo = document.createElement('span');
    stepNo.className = 'wolf-step-no';
    stepNo.textContent = 'STEP 2';
    const stepTitle = document.createElement('strong');
    stepTitle.textContent = '設定各角色人數';
    const stepSmall = document.createElement('small');
    stepSmall.textContent = oneSelectedPreset ? `已帶入「${oneSelectedPreset.label}」的配置,可再增減` : '可自由增減各角色人數';
    step.append(stepNo, stepTitle, stepSmall);
    oneCustom.appendChild(step);
    const heading = document.createElement('div');
    heading.className = 'sync-heading';
    heading.style.marginBottom = '10px';
    const icon = document.createElement('div');
    icon.className = 'sync-icon wolf-sync-icon';
    icon.textContent = '⚙️';
    const copy = document.createElement('div');
    copy.className = 'sync-heading-copy';
    const kicker = document.createElement('p');
    kicker.className = 'tool-card-kicker';
    kicker.textContent = 'ROLE COUNTS';
    const h4 = document.createElement('h4');
    h4.textContent = '各角色人數';
    copy.append(kicker, h4);
    heading.append(icon, copy);
    oneCustom.appendChild(heading);
    const list = document.createElement('div');
    list.className = 'wolf-custom-roles';
    Object.keys(ONE_ROLES).forEach((roleId) => {
      const row = document.createElement('div');
      row.className = 'wolf-custom-role';
      const label = document.createElement('span');
      label.textContent = `${ONE_ROLES[roleId].emoji} ${ONE_ROLES[roleId].name}`;
      const count = oneCustomRoles.filter((id) => id === roleId).length;
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `減少${ONE_ROLES[roleId].name}`);
      minus.disabled = count <= 0;
      minus.addEventListener('click', () => {
        const index = oneCustomRoles.lastIndexOf(roleId);
        if (index >= 0) {
          oneCustomRoles.splice(index, 1);
          $$('.wolf-preset', onePresetList).forEach((el) => el.classList.remove('is-selected'));
          oneSelectedPreset = null;
          renderOneCustom();
        }
      });
      const value = document.createElement('strong');
      value.textContent = String(count);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '＋';
      plus.setAttribute('aria-label', `增加${ONE_ROLES[roleId].name}`);
      plus.disabled = oneCustomRoles.length >= 8;
      plus.addEventListener('click', () => {
        if (oneCustomRoles.length < 8) {
          oneCustomRoles.push(roleId);
          $$('.wolf-preset', onePresetList).forEach((el) => el.classList.remove('is-selected'));
          oneSelectedPreset = null;
          renderOneCustom();
        }
      });
      row.append(label, minus, value, plus);
      list.appendChild(row);
    });
    const summary = document.createElement('p');
    summary.className = 'wolf-custom-summary';
    const wolves = oneCustomRoles.filter((id) => id === 'werewolf').length;
    const total = oneCustomRoles.length;
    summary.textContent = `目前 ${total} 人：${wolves} 狼 / ${total - wolves} 神民${wolves >= 1 && total >= 4 ? ' · 配置合理' : ' · 建議 4-8 人,且至少 1 狼'}`;
    oneCustom.append(list, summary);
  }

  function oneBuildSteps() {
    return [
      { id: 'reveal', label: '發牌', title: '查看你的身份', hint: '每個人確認自己的秘密身份後按「看完了」。', secs: 0, voice: '每人查看自己手機上的身份,確認後按看完了。' },
      { id: 'night-open', label: '夜晚 · 天黑請閉眼', title: '天黑請閉眼', hint: '請大家閉上眼睛,把手機蓋在桌上。', secs: 0, voice: '天黑請閉眼。' },
      { id: 'wolves', label: '夜晚 · 狼人', title: '狼人請睜眼', hint: '狼人互相確認身份,再閉眼。', secs: 0, target: 'client', role: 'werewolf', pick: 'mates', voice: '狼人請睜眼,互相確認身份。' },
      { id: 'seer', label: '夜晚 · 預言家', title: '預言家請睜眼', hint: '選擇一名玩家查看身份牌。', secs: 0, target: 'client', role: 'seer', pick: 'check', voice: '預言家請睜眼,選擇一名玩家查看身份。' },
      { id: 'robber', label: '夜晚 · 強盜', title: '強盜請睜眼', hint: '選擇一名玩家交換身份牌。', secs: 0, target: 'client', role: 'robber', pick: 'rob', voice: '強盜請睜眼,選擇一名玩家交換身份。' },
      { id: 'troublemaker', label: '夜晚 · 搗蛋鬼', title: '搗蛋鬼請睜眼', hint: '交換另外兩名玩家的身份牌。', secs: 0, target: 'client', role: 'troublemaker', pick: 'swap2', voice: '搗蛋鬼請睜眼,交換另外兩名玩家的身份牌。' },
      { id: 'insomniac', label: '夜晚 · 失眠者', title: '失眠者請睜眼', hint: '確認自己的身份牌有沒有被換走。', secs: 0, target: 'client', role: 'insomniac', pick: 'self', voice: '失眠者請睜眼,確認自己的身份牌。' },
      { id: 'dawn', label: '天亮了', title: '天亮了', hint: '看一下手機上最終的身份,準備討論。', secs: 0, voice: '天亮了,請看自己手機上的最終身份。' },
      { id: 'discuss', label: '討論', title: '討論時間', hint: '天亮後,大家討論誰現在是狼人。', secs: 180, timer: true, voice: '討論開始,找出現在真正的狼人。' },
      { id: 'vote', label: '投票', title: '投票指認', hint: '投給你認為現在是狼人的人。', secs: 0, voice: '請投票,指認你認為是狼人的人。' },
      { id: 'result', label: '揭曉', title: '揭曉結果', hint: '', secs: 0, voice: '揭曉結果。' },
    ];
  }

  function createOneNightRoom() {
    if (oneSync.mode !== 'local') return;
    const solo = oneSoloWanted();
    if (!solo && typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      return;
    }
    const wolves = oneCustomRoles.filter((id) => id === 'werewolf').length;
    const total = oneCustomRoles.length;
    if (total < 4 || total > 8) { showToast('一夜狼人適合 4-8 人'); return; }
    if (wolves < 1) { showToast('至少要 1 隻狼'); return; }
    const code = makeRoomCode();
    const roles = [...oneCustomRoles];
    for (let index = roles.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [roles[index], roles[swapIndex]] = [roles[swapIndex], roles[index]];
    }
    oneSync.solo = solo;
    resetOneSoloState();
    oneSync.code = code;
    oneSync.mySlot = 0;
    oneSync.conns = [];
    oneSync.config = { roles, voice: oneVoiceToggle.checked };
    oneSync.players = roles.map((role, index) => ({
      name: `玩家 ${index + 1}`,
      role,
      initialRole: role,
      joined: solo || index === 0,
      ready: false,
      acted: false,
      voted: false,
      online: solo || index === 0,
    }));
    oneSync.steps = oneBuildSteps();
    oneSync.stepIndex = 0;
    oneSync.targets = {};
    oneSync.votes = {};
    oneSync.over = null;
    oneSync.resultForMe = null;
    oneSync.wolfMates = [];
    oneSetMode('host');
    if (solo) {
      oneBadge.textContent = '離線單機';
      oneUpdateStatus('離線單機 · 免網路、免 QR,輪流傳手機;螢幕保持常亮');
      soloKeepScreenAwake();
      oneQrGrid.hidden = true;
      oneEnterStep();
      return;
    }
    oneBadge.textContent = '房主';
    oneUpdateStatus('建立中…');
    oneQrGrid.hidden = true;
    onePeerCreate(`${ONE_HOST_PREFIX}${code.toLowerCase()}`);
    oneEnterStep();
  }

  function onePeerCreate(hostId) {
    const peer = new Peer(hostId, { debug: 1 });
    oneSync.peer = peer;
    peer.on('open', () => {
      oneSync.ready = true;
      oneUpdateStatus(`房間代號 ${oneSync.code} · 等大家掃 QR 加入`);
      renderOneQrGrid();
      renderOneHostView();
    });
    peer.on('connection', (conn) => setupOneHostConnection(conn));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突,請重試'); resetOneNightSync(); }
      else if (type === 'invalid-id') { showToast('連線設定錯誤'); resetOneNightSync(); }
      else showToast('連線暫時不穩,仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function renderOneQrGrid() {
    oneQrGrid.replaceChildren();
    if (typeof qrcode !== 'function') {
      oneQrGrid.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    for (let slot = 1; slot < oneSync.players.length; slot += 1) {
      const url = `${base}?${new URLSearchParams({ one: oneSync.code, p: String(slot) }).toString()}`;
      oneQrGrid.appendChild(buildQrCard(slot, url, '掃描後設定名字,再查看秘密身份'));
    }
    oneQrGrid.hidden = false;
  }

  function makeOneClientId(code, slot) {
    return `${ONE_HOST_PREFIX}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function joinOneNightRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      oneSetMode('local');
      return;
    }
    oneSync.code = code;
    oneSync.mySlot = slot;
    oneSync.conns = [];
    oneSync.players = [];
    oneSetMode('client');
    oneClientUpdateStatus(`正在連線「${code}」…`);
    const peer = new Peer(makeOneClientId(code, slot), { debug: 1 });
    oneSync.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${ONE_HOST_PREFIX}${code.toLowerCase()}`, { reliable: true });
      oneSync.conn = conn;
      conn.on('open', () => {
        conn.send({ type: 'hello', slot, name: `玩家 ${slot + 1}` });
      });
      conn.on('data', (message) => { try { handleOneClientMessage(message); } catch (error) { /* ignore */ } });
      conn.on('close', () => oneClientUpdateStatus('已中斷連線,請重新掃描 QR'));
      conn.on('error', () => oneClientUpdateStatus('連線中斷,請重新掃描 QR'));
    });
    peer.on('error', () => {
      showToast('連線失敗,請確認網路');
      oneClientUpdateStatus('連線失敗,請確認網路後重新掃描');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function setupOneHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { handleOneHostMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => removeOneHostConn(conn));
    conn.on('error', () => removeOneHostConn(conn));
  }

  // 共用行動引擎:線上(玩家手機)與離線單機(主持人代點)共用同一套查驗/換牌邏輯。
  // 行動者以「發到的那張牌」(initialRole)認定,與玩家端畫面一致;換牌不影響今晚的行動順序。
  function oneApplyAct(slot, pick, payload = {}) {
    const player = oneSync.players[slot];
    if (!player) return false;
    const step = oneSync.steps[oneSync.stepIndex] || null;
    if (!step || step.pick !== pick || player.initialRole !== step.role) return false;
    player.acted = true;
    if (pick === 'check') {
      const target = clamp(Math.floor(Number(payload.target)), 0, oneSync.players.length - 1);
      oneSync.targets.seer = target;
      oneSync.resultForMe = {
        forSlot: slot,
        kind: 'check',
        targetName: oneSync.players[target].name,
        isWolf: oneSync.players[target].initialRole === 'werewolf',
      };
    } else if (pick === 'rob') {
      const target = clamp(Math.floor(Number(payload.target)), 0, oneSync.players.length - 1);
      if (target === slot) { player.acted = false; return false; }
      const robberOld = player.role;
      const victimOld = oneSync.players[target].role;
      player.role = victimOld;
      oneSync.players[target].role = robberOld;
      oneSync.targets.rob = target;
      oneSync.resultForMe = { forSlot: slot, kind: 'role', roleId: victimOld };
    } else if (pick === 'swap2') {
      const targets = Array.isArray(payload.targets) ? payload.targets.map((value) => clamp(Math.floor(Number(value)), 0, oneSync.players.length - 1)) : [];
      if (targets.length === 2 && targets[0] !== targets[1] && !targets.includes(slot)) {
        const roleA = oneSync.players[targets[0]].role;
        const roleB = oneSync.players[targets[1]].role;
        oneSync.players[targets[0]].role = roleB;
        oneSync.players[targets[1]].role = roleA;
        oneSync.targets.swap2 = targets;
      }
    } else if (pick === 'self') {
      oneSync.resultForMe = { forSlot: slot, kind: 'role', roleId: player.role };
    }
    return true;
  }

  function handleOneHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 1), 0, oneSync.players.length - 1);
      if (!oneSync.players[slot]) return;
      oneSync.players[slot].joined = true;
      oneSync.players[slot].online = true;
      oneSync.conns.push({ conn, slot });
      const joined = oneSync.players.filter((player) => player.joined).length;
      oneUpdateStatus(`房間代號 ${oneSync.code} · 已加入 ${joined}/${oneSync.players.length} 人`);
      broadcastOneState();
    } else if (message.type === 'ready') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, oneSync.players.length - 1);
      if (oneSync.players[slot]) {
        oneSync.players[slot].ready = true;
        broadcastOneState();
      }
    } else if (message.type === 'name') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, oneSync.players.length - 1);
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${slot + 1}`;
      if (oneSync.players[slot]) {
        const oldName = oneSync.players[slot].name;
        oneSync.players[slot].name = name;
        if (oldName !== name) showToast(`${oldName} 改名為 ${name}`);
        broadcastOneState();
      }
    } else if (message.type === 'act') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, oneSync.players.length - 1);
      const applied = oneApplyAct(slot, validString(message.pick, ''), message);
      if (applied) broadcastOneState();
    } else if (message.type === 'vote') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 0, oneSync.players.length - 1);
      if (!oneSync.players[slot]) return;
      if (message.target === null || message.target === undefined) {
        oneSync.votes[slot] = null;
      } else {
        oneSync.votes[slot] = clamp(Math.floor(Number(message.target)), 0, oneSync.players.length - 1);
      }
      oneSync.players[slot].voted = true;
      broadcastOneState();
    }
  }

  function removeOneHostConn(conn) {
    const before = oneSync.conns.length;
    const removed = oneSync.conns.find((entry) => entry.conn === conn);
    oneSync.conns = oneSync.conns.filter((entry) => entry.conn !== conn);
    if (removed && oneSync.players[removed.slot]) oneSync.players[removed.slot].online = false;
    if (oneSync.conns.length !== before) {
      const joined = oneSync.players.filter((player) => player.joined).length;
      oneUpdateStatus(`房間代號 ${oneSync.code} · 已加入 ${joined}/${oneSync.players.length} 人`);
      broadcastOneState();
    }
  }

  function resetOneNightSync() {
    if (oneSync.timerInterval) { window.clearInterval(oneSync.timerInterval); oneSync.timerInterval = null; }
    try { if (oneSync.peer) oneSync.peer.destroy(); } catch (error) { /* ignore */ }
    oneSync.mode = 'local';
    oneSync.code = '';
    oneSync.peer = null;
    oneSync.conns = [];
    oneSync.conn = null;
    oneSync.mySlot = 0;
    oneSync.ready = false;
    oneSync.config = null;
    oneSync.players = [];
    oneSync.steps = [];
    oneSync.stepIndex = -1;
    oneSync.targets = {};
    oneSync.votes = {};
    oneSync.over = null;
    oneSync.resultForMe = null;
    oneSync.wolfMates = [];
    oneSync.timerLeft = 0;
    oneSwapPicks = [];
    if (oneSync.solo) soloAllowScreenSleep();
    oneSync.solo = false;
    resetOneSoloState();
    oneBadge.textContent = '房主';
    oneSetMode('local');
  }

  function oneSetMode(mode) {
    oneSync.mode = mode;
    const connected = mode !== 'local';
    oneSetupPanel.hidden = connected;
    oneHostPanel.hidden = mode !== 'host';
    oneClientPanel.hidden = mode !== 'client';
    endOneRoomButton.hidden = !connected;
    oneNextButton.hidden = mode !== 'host';
    if (!connected) {
      oneStatus.hidden = true;
      oneQrGrid.hidden = true;
      oneControl.hidden = true;
      onePhaseActions.replaceChildren();
      onePhaseLabel.textContent = '準備中';
      onePhaseTitle.textContent = '等大家加入';
      onePhaseHint.textContent = '';
      oneClientStatus.textContent = '尚未加入房間';
    } else {
      oneControl.hidden = mode !== 'host';
      if (mode === 'client') oneQrGrid.hidden = true;
      if (mode === 'host') renderOneHostView();
      if (mode === 'client') renderOneClient();
    }
  }

  function oneUpdateStatus(text) {
    if (oneSync.mode === 'host') {
      oneStatus.textContent = text;
      oneStatus.hidden = false;
    }
  }

  function oneClientUpdateStatus(text) {
    oneClientStatus.textContent = text;
  }

  function sendToOneHost(message) {
    if (oneSync.conn && oneSync.conn.open) {
      try { oneSync.conn.send(message); } catch (error) { /* ignore */ }
    } else {
      showToast('尚未連上主持人');
    }
  }

  function broadcastOneState() {
    const payload = {
      type: 'state',
      players: oneSync.players.map((player) => ({
        name: player.name,
        role: player.role,
        initialRole: player.initialRole,
        joined: player.joined,
        ready: player.ready,
        acted: player.acted,
        voted: player.voted,
        online: player.online !== false,
      })),
      stepIndex: oneSync.stepIndex,
      steps: oneSync.steps.map((step) => ({
        id: step.id, label: step.label, title: step.title, hint: step.hint,
        target: step.target, role: step.role, pick: step.pick, timer: Boolean(step.timer),
      })),
      targets: { ...oneSync.targets },
      votes: { ...oneSync.votes },
      over: oneSync.over,
      resultForMe: null,
      wolfMates: [],
      timerLeft: oneSync.timerLeft,
    };
    const step = oneSync.steps[oneSync.stepIndex];
    const wolfSlots = oneSync.players.map((player, index) => (player.initialRole === 'werewolf' ? index : -1)).filter((index) => index >= 0);
    oneSync.conns.forEach(({ conn, slot }) => {
      const me = oneSync.players[slot] || {};
      const myCopy = JSON.parse(JSON.stringify(payload));
      // Secret roles: scrub everyone's role except the recipient's own.
      myCopy.players = myCopy.players.map((player, index) => (
        index === slot ? player : { ...player, role: null, initialRole: null }
      ));
      // Wolves see their mates during the wolves step only.
      if (step && step.id === 'wolves' && me.initialRole === 'werewolf') {
        myCopy.wolfMates = wolfSlots;
      }
      // Private night results go only to the right player.
      if (oneSync.resultForMe && oneSync.resultForMe.forSlot === slot) {
        const { forSlot, ...rest } = oneSync.resultForMe;
        myCopy.resultForMe = rest;
      }
      try { conn.send(myCopy); } catch (error) { /* ignore */ }
    });
    renderOneHostView();
  }

  function handleOneClientMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state' && Array.isArray(message.players)) {
      oneSync.players = message.players.map((player) => ({
        name: validString(player.name, '玩家').trim().slice(0, 14) || '玩家',
        role: player.role || null,
        initialRole: player.initialRole || null,
        joined: Boolean(player.joined),
        ready: Boolean(player.ready),
        acted: Boolean(player.acted),
        voted: Boolean(player.voted),
        online: player.online !== false,
      }));
      oneSync.steps = message.steps || [];
      oneSync.stepIndex = message.stepIndex || 0;
      oneSync.targets = message.targets || {};
      oneSync.votes = message.votes || {};
      oneSync.over = message.over || null;
      oneSync.resultForMe = message.resultForMe || null;
      oneSync.wolfMates = Array.isArray(message.wolfMates) ? message.wolfMates : [];
      oneSync.timerLeft = message.timerLeft || 0;
      oneSync.ready = true;
      oneClientUpdateStatus(`已連線 · 玩家 ${oneSync.mySlot + 1}`);
      oneSwapPicks = [];
      renderOneClient();
    }
  }

  function oneResolveResult() {
    const counts = {};
    Object.keys(oneSync.votes).forEach((key) => {
      const target = oneSync.votes[key];
      if (target !== null && target !== undefined && Number.isInteger(target)) {
        counts[target] = (counts[target] || 0) + 1;
      }
    });
    let top = null;
    let topCount = 0;
    let tie = false;
    Object.keys(counts).forEach((key) => {
      const slot = Number(key);
      if (counts[slot] > topCount) { top = slot; topCount = counts[slot]; tie = false; }
      else if (counts[slot] === topCount) tie = true;
    });
    if (tie) top = null;
    const votedRole = top !== null && oneSync.players[top] ? oneSync.players[top].role : null;
    const villageWin = votedRole === 'werewolf';
    oneSync.over = { camp: villageWin ? 'village' : 'wolf', votedSlot: top };
  }

  function oneAdvance() {
    oneSync.stepIndex += 1;
    oneEnterStep();
  }

  // 離線單機時的標題/提示文案。
  function oneSoloStepCopy(step) {
    if (!oneSync.solo || !step) return null;
    if (step.id === 'reveal') {
      return { title: '傳手機發牌', hint: '把手機輪流傳給每位玩家:看身份、順手改顯示名稱,蓋牌後傳下一位。' };
    }
    if (step.id === 'vote') {
      return { title: '投票 · 主持人代投', hint: '輪到的玩家用手指比人,主持人點黑卡收票;收齊後自動揭曉。' };
    }
    if (step.target === 'client') {
      return { hint: '本人睜眼行動:比手勢或看畫面,主持人代為點選。' };
    }
    return null;
  }

  function oneEnterStep() {
    let step = oneSync.steps[oneSync.stepIndex];
    if (!step) return;
    // 離線單機:本局沒有的角色直接跳過該夜晚步驟(沒人可行動)。
    while (oneSync.solo && step && step.target === 'client' && step.role
      && !oneSync.players.some((player) => player.initialRole === step.role)) {
      oneSync.stepIndex += 1;
      step = oneSync.steps[oneSync.stepIndex];
      if (!step) return;
    }
    if (step.id === 'wolves') {
      oneSync.wolfMates = oneSync.players.map((player, index) => (player.initialRole === 'werewolf' ? index : -1)).filter((index) => index >= 0);
    }
    if (step.id === 'night-open') {
      oneSync.targets = {};
      oneSync.resultForMe = null;
    }
    if (step.id === 'dawn') oneSync.resultForMe = null;
    if (step.id === 'vote') {
      oneSync.votes = {};
      oneSoloVote = { idx: 0 };
    }
    if (step.id === 'result') oneResolveResult();
    oneSync.players.forEach((player) => {
      player.ready = false;
      player.acted = false;
      player.voted = false;
    });
    if (oneSync.mode === 'host') {
      const copy = oneSoloStepCopy(step);
      onePhaseLabel.textContent = step.label || '';
      onePhaseTitle.textContent = copy && copy.title ? copy.title : (step.title || '');
      renderOnePhaseHint();
      renderOneHostView();
      if (oneSync.timerInterval) { window.clearInterval(oneSync.timerInterval); oneSync.timerInterval = null; }
      oneSync.timerLeft = step.timer ? step.secs : 0;
      if (step.timer) {
        oneSync.timerInterval = window.setInterval(() => {
          oneSync.timerLeft = Math.max(0, oneSync.timerLeft - 1);
          renderOnePhaseHint();
          if (oneSync.timerLeft === 0) {
            window.clearInterval(oneSync.timerInterval);
            oneSync.timerInterval = null;
            oneSpeak('時間到,請開始投票。');
            showToast('時間到,請開始投票');
            vibrate([60, 40, 90]);
          }
        }, 1000);
        renderOnePhaseHint();
      }
      oneSpeak(step.voice || '');
    } else {
      renderOneClient();
    }
    broadcastOneState();
  }

  function renderOnePhaseHint() {
    const step = oneSync.steps[oneSync.stepIndex] || null;
    if (!step) return;
    const copy = oneSync.mode === 'host' ? oneSoloStepCopy(step) : null;
    let text = (copy && copy.hint) || step.hint || '';
    if (step.timer) {
      const minutes = Math.floor(oneSync.timerLeft / 60);
      const seconds = oneSync.timerLeft % 60;
      text += `（${pad(minutes)}:${pad(seconds)}）`;
    }
    onePhaseHint.textContent = text;
    onePhaseHint.classList.toggle('wolf-timer', step.timer);
  }

  function renderOneRoster() {
    oneRoster.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'list-heading';
    const left = document.createElement('span');
    const step = oneSync.steps[oneSync.stepIndex] || null;
    const stepId = step ? step.id : '';
    const ready = oneSync.players.filter((player) => player.ready).length;
    const voted = oneSync.players.filter((player) => player.voted).length;
    // 離線發牌中手機會傳到每個人手上,貓紙先藏起來,發完才顯示。
    const dealing = oneSync.solo && stepId === 'reveal' && oneSoloDeal.slot < oneSync.players.length;
    let stateText = '';
    if (dealing) stateText = `· ${oneSoloDeal.slot}/${oneSync.players.length} 已看牌`;
    else if (stepId === 'vote') stateText = `· 已投票 ${voted}/${oneSync.players.length}`;
    else if (stepId === 'reveal') stateText = `· 已確認 ${ready}/${oneSync.players.length}`;
    left.textContent = dealing ? `發牌中${stateText}` : `身份總覽（貓紙）${stateText}`;
    heading.appendChild(left);
    oneRoster.appendChild(heading);
    if (dealing) {
      oneSync.players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'wolf-player';
        const rank = document.createElement('span');
        rank.className = 'wolf-player-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('strong');
        name.className = 'wolf-player-name';
        name.textContent = player.name;
        const status = document.createElement('span');
        status.className = 'wolf-player-role';
        status.textContent = index < oneSoloDeal.slot ? '✅ 已看牌' : '🂠 待看牌';
        row.append(rank, name, status);
        oneRoster.appendChild(row);
      });
      return;
    }
    oneSync.players.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'wolf-player'
        + (index === oneSync.mySlot ? ' is-me' : '')
        + (player.online === false ? ' is-dead' : '');
      const rank = document.createElement('span');
      rank.className = 'wolf-player-rank';
      rank.textContent = pad(index + 1);
      const name = document.createElement('strong');
      name.className = 'wolf-player-name';
      name.textContent = player.name + (player.online === false ? '（離線）' : '');
      const role = document.createElement('span');
      role.className = 'wolf-player-role';
      const roleInfo = oneRoleById(player.role);
      role.textContent = `${roleInfo.emoji} ${roleInfo.name}`;
      row.append(rank, name, role);
      oneRoster.appendChild(row);
    });
  }

  function oneNextLabel(step) {
    if (!step) return '下一步 <span>↗</span>';
    if (step.id === 'reveal') return '天黑請閉眼 <span>🌙</span>';
    if (step.id === 'night-open') return '狼人請睜眼 <span>🐺</span>';
    if (step.id === 'dawn') return '開始討論 <span>🗣️</span>';
    if (step.id === 'discuss') return '提早收票,開始投票 <span>🗳️</span>';
    if (step.id === 'vote') return '揭曉結果 <span>🎬</span>';
    return '下一步 <span>↗</span>';
  }

  // ---- 離線單機:傳手機發牌 ----
  function oneSoloDealUI() {
    const total = oneSync.players.length;
    const dealt = Math.min(oneSoloDeal.slot, total);
    if (dealt >= total) {
      onePhaseActions.appendChild(soloProgressNote(`✅ ${total} 人都看過身份了,手機交回主持人。`));
      return;
    }
    const player = oneSync.players[dealt];
    if (!oneSoloDeal.peeked) {
      onePhaseActions.appendChild(soloProgressNote(`傳手機發牌 · 第 ${dealt + 1}/${total} 位`));
      const card = soloHandoffCard('請把手機交給', `${pad(dealt + 1)} ${player.name}`, '本人拿起手機後,點這張黑牌看身份');
      card.addEventListener('click', () => {
        oneSoloDeal.peeked = true;
        renderOnePhaseActions();
      });
      onePhaseActions.appendChild(card);
      return;
    }
    onePhaseActions.appendChild(oneRoleCard(`${player.name} · 你的秘密身份`, player.initialRole));
    onePhaseActions.appendChild(soloNameEditor(player, dealt, () => { broadcastOneState(); }));
    const action = document.createElement('div');
    action.className = 'wolf-action';
    const done = document.createElement('button');
    done.className = 'button button-primary button-large';
    done.type = 'button';
    done.innerHTML = dealt + 1 >= total ? '看完了,交回主持人 <span>▣</span>' : '看完了,蓋牌給下一位 <span>▣</span>';
    done.addEventListener('click', () => {
      player.ready = true;
      oneSoloDeal.slot = dealt + 1;
      oneSoloDeal.peeked = false;
      renderOnePhaseActions();
      renderOneRoster();
    });
    action.appendChild(done);
    onePhaseActions.appendChild(action);
  }

  // ---- 離線單機:夜晚行動(主持人代點,結果只給當事人看) ----
  function oneSoloNightUI(step) {
    const roleInfo = oneRoleById(step.role);
    const wrap = document.createElement('div');
    wrap.className = 'wolf-action';
    const heading = document.createElement('h5');
    heading.textContent = `${roleInfo.emoji} ${roleInfo.name}行動 · 主持人代操作`;
    wrap.appendChild(heading);
    onePhaseActions.appendChild(wrap);
    const actor = oneSync.players.find((player) => player.initialRole === step.role && !player.acted);
    if (step.pick === 'mates') {
      const wolves = oneSync.players
        .map((player, slot) => ({ ...player, slot }))
        .filter((player) => player.initialRole === 'werewolf');
      const allDone = wolves.every((wolf) => wolf.acted);
      if (allDone) {
        onePhaseActions.appendChild(soloProgressNote('✅ 狼人已相認,可以下一步。'));
        return;
      }
      const names = wolves.map((wolf) => wolf.name).join('、');
      onePhaseActions.appendChild(soloPeekCard(
        '🐺 狼人同伴（拿給狼人看）',
        wolves.length > 1 ? names : '你是今晚唯一的狼人',
        '狼人請睜眼,主持人把畫面拿給狼人看;其他人別偷看。',
      ));
      const done = wolfOptionButton('狼人記住了,繼續', () => {
        wolves.forEach((wolf) => oneApplyAct(wolf.slot, 'mates'));
        renderOneHostView();
      });
      onePhaseActions.appendChild(done);
      return;
    }
    if (!actor) {
      if (step.pick === 'check' && oneSync.resultForMe && oneSync.resultForMe.kind === 'check') {
        const result = oneSync.resultForMe;
        onePhaseActions.appendChild(soloPeekCard(
          '🔮 查驗結果（拿給預言家看）',
          `${result.targetName} 是 ${result.isWolf ? '🐺 狼人' : '😇 好人'}`,
          '點一下顯示、再點一下藏起來,只給預言家看。',
        ));
      } else if ((step.pick === 'rob' || step.pick === 'self') && oneSync.resultForMe && oneSync.resultForMe.kind === 'role') {
        const newRole = oneRoleById(oneSync.resultForMe.roleId);
        onePhaseActions.appendChild(soloPeekCard(
          step.pick === 'rob' ? '🦹 換到的身份（拿給強盜看）' : '😴 你現在的身份（拿給失眠者看）',
          `${newRole.emoji} ${newRole.name}`,
          '點一下顯示、再點一下藏起來,只給本人看。',
        ));
      } else if (step.pick === 'swap2' && Array.isArray(oneSync.targets.swap2)) {
        onePhaseActions.appendChild(soloProgressNote(`✅ 已交換 ${oneSync.players[oneSync.targets.swap2[0]].name} 和 ${oneSync.players[oneSync.targets.swap2[1]].name} 的身份牌。`));
      } else {
        onePhaseActions.appendChild(soloProgressNote('✅ 已行動完成,可以下一步。'));
      }
      return;
    }
    const actorSlot = oneSync.players.indexOf(actor);
    if (step.pick === 'check') {
      const targets = oneSync.players
        .map((player, slot) => ({ ...player, slot }))
        .filter((player) => player.slot !== actorSlot);
      onePhaseActions.appendChild(oneTargetList(targets, 'check', {
        onPick: (player) => {
          oneApplyAct(actorSlot, 'check', { target: player.slot });
          renderOneHostView();
        },
      }));
      return;
    }
    if (step.pick === 'rob') {
      const targets = oneSync.players
        .map((player, slot) => ({ ...player, slot }))
        .filter((player) => player.slot !== actorSlot);
      onePhaseActions.appendChild(oneTargetList(targets, 'rob', {
        onPick: (player) => {
          oneApplyAct(actorSlot, 'rob', { target: player.slot });
          renderOneHostView();
        },
      }));
      return;
    }
    if (step.pick === 'swap2') {
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = '搗蛋鬼比出兩個人,主持人點選(不能選搗蛋鬼自己):';
      onePhaseActions.appendChild(note);
      const entries = oneSync.players
        .map((player, slot) => ({ ...player, slot }))
        .filter((player) => player.slot !== actorSlot);
      onePhaseActions.appendChild(soloCardGrid(entries, {
        onPick: (entry) => {
          if (oneSoloSwapPicks.includes(entry.slot)) oneSoloSwapPicks = oneSoloSwapPicks.filter((slot) => slot !== entry.slot);
          else if (oneSoloSwapPicks.length < 2) oneSoloSwapPicks.push(entry.slot);
          renderOnePhaseActions();
        },
      }));
      if (oneSoloSwapPicks.length === 2) {
        const confirmBtn = wolfOptionButton(`交換 ${oneSoloSwapPicks.map((slot) => oneSync.players[slot].name).join(' 和 ')}`, () => {
          oneApplyAct(actorSlot, 'swap2', { targets: [...oneSoloSwapPicks] });
          oneSoloSwapPicks = [];
          renderOneHostView();
        });
        onePhaseActions.appendChild(confirmBtn);
      }
      return;
    }
    if (step.pick === 'self') {
      const currentRole = oneRoleById(actor.role);
      onePhaseActions.appendChild(soloPeekCard(
        '😴 你現在的身份（拿給失眠者看）',
        `${currentRole.emoji} ${currentRole.name}`,
        '點一下顯示、再點一下藏起來,只給本人看。',
      ));
      const done = wolfOptionButton('失眠者確認完成', () => {
        oneApplyAct(actorSlot, 'self');
        renderOneHostView();
      });
      onePhaseActions.appendChild(done);
      return;
    }
  }

  // ---- 離線單機:投票(玩家指人,主持人點黑卡) ----
  function oneSoloVoteUI() {
    const voters = oneSync.players.map((player, slot) => ({ ...player, slot }));
    const collected = voters.filter((player) => oneSync.votes[player.slot] !== undefined).length;
    onePhaseActions.appendChild(soloProgressNote(`主持人代投 · 已收 ${collected}/${voters.length} 票`));
    if (oneSoloVote.idx >= voters.length) {
      const reveal = document.createElement('button');
      reveal.className = 'button button-secondary';
      reveal.type = 'button';
      reveal.innerHTML = '揭曉結果 <span>🎬</span>';
      reveal.addEventListener('click', () => oneAdvance());
      onePhaseActions.appendChild(reveal);
      return true;
    }
    const voter = voters[oneSoloVote.idx];
    const who = document.createElement('p');
    who.className = 'solo-vote-who';
    who.textContent = `現在投票：${pad(voter.slot + 1)} ${voter.name} — 用手指比,主持人點卡`;
    onePhaseActions.appendChild(who);
    const entries = voters.filter((player) => player.slot !== voter.slot);
    onePhaseActions.appendChild(soloCardGrid(entries, {
      selectedSlot: oneSync.votes[voter.slot],
      onPick: (entry) => {
        oneSync.votes[voter.slot] = entry.slot;
        oneSync.players[voter.slot].voted = true;
        oneSoloVote.idx += 1;
        renderOnePhaseActions();
      },
    }));
    const row = document.createElement('div');
    row.className = 'solo-row';
    const abstain = wolfOptionButton('這票棄權', () => {
      oneSync.votes[voter.slot] = null;
      oneSync.players[voter.slot].voted = true;
      oneSoloVote.idx += 1;
      renderOnePhaseActions();
    });
    const redo = wolfOptionButton('↩︎ 重收上一票', () => {
      if (oneSoloVote.idx > 0) {
        oneSoloVote.idx -= 1;
        const prev = voters[oneSoloVote.idx];
        if (prev) {
          delete oneSync.votes[prev.slot];
          oneSync.players[prev.slot].voted = false;
        }
        renderOnePhaseActions();
      }
    });
    redo.disabled = oneSoloVote.idx === 0;
    row.append(abstain, redo);
    onePhaseActions.appendChild(row);
    return false;
  }

  function renderOnePhaseActions() {
    onePhaseActions.replaceChildren();
    const step = oneSync.steps[oneSync.stepIndex] || null;
    if (!step) return;
    const solo = oneSync.solo === true;
    let hideNext = false;
    if (step.id === 'result' && oneSync.over) {
      const banner = document.createElement('div');
      banner.className = 'wolf-winner';
      banner.textContent = oneSync.over.camp === 'village' ? '🌞 村民獲勝' : '🐺 狼人獲勝';
      onePhaseActions.appendChild(banner);
      const detail = document.createElement('p');
      detail.className = 'wolf-custom-summary';
      if (Number.isInteger(oneSync.over.votedSlot)) {
        const votedPlayer = oneSync.players[oneSync.over.votedSlot];
        const roleInfo = oneRoleById(votedPlayer.role);
        detail.textContent = `被投出的是 ${votedPlayer.name},最終身份是 ${roleInfo.emoji} ${roleInfo.name}。`;
      } else {
        detail.textContent = '平票或全棄權,無人被投出,狼人獲勝。';
      }
      onePhaseActions.appendChild(detail);
      oneNextButton.hidden = true;
      return;
    }
    if (step.id === 'vote') {
      if (solo) {
        hideNext = !oneSoloVoteUI();
      } else {
        const voted = oneSync.players.filter((player) => player.voted).length;
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = `已投票 ${voted}/${oneSync.players.length} 人。`;
        onePhaseActions.appendChild(note);
      }
    } else if (step.id === 'reveal') {
      if (solo) {
        oneSoloDealUI();
        hideNext = oneSoloDeal.slot < oneSync.players.length;
      } else {
        const ready = oneSync.players.filter((player) => player.ready).length;
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = `已確認 ${ready}/${oneSync.players.length} 人。`;
        onePhaseActions.appendChild(note);
      }
    } else if (step.target === 'client' && step.role) {
      if (solo) {
        oneSoloNightUI(step);
      } else {
        const roleInfo = oneRoleById(step.role);
        const acted = oneSync.players.filter((player) => player.acted).length;
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = `等 ${roleInfo.name} 在手機上行動${acted ? '（已完成）' : ''}。`;
        onePhaseActions.appendChild(note);
      }
    }
    oneNextButton.hidden = hideNext;
    oneNextButton.innerHTML = oneNextLabel(step);
  }

  function renderOneHostView() {
    if (oneSync.mode !== 'host') return;
    renderOnePhaseActions();
    renderOneRoster();
  }

  function oneNameEditor() {
    const me = oneSync.players[oneSync.mySlot];
    const wrap = document.createElement('div');
    if (!me) return wrap;
    wrap.className = 'wolf-action';
    const labelEl = document.createElement('h5');
    labelEl.textContent = '顯示名稱（主持人靠這個認人）';
    const nameInput = document.createElement('input');
    nameInput.className = 'sync-my-name';
    nameInput.type = 'text';
    nameInput.maxLength = 14;
    nameInput.value = me.name;
    nameInput.setAttribute('aria-label', '我的顯示名稱');
    nameInput.addEventListener('change', () => {
      const value = nameInput.value.trim().slice(0, 14) || `玩家 ${oneSync.mySlot + 1}`;
      oneSync.players[oneSync.mySlot].name = value;
      sendToOneHost({ type: 'name', slot: oneSync.mySlot, name: value });
      renderOneClient();
    });
    wrap.append(labelEl, nameInput);
    return wrap;
  }

  function oneTargetList(targets, pick, options = {}) {
    const list = document.createElement('div');
    list.className = 'wolf-target-list';
    targets.forEach((player) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wolf-target';
      button.disabled = (options.disabled && options.disabled(player)) || false;
      const rank = document.createElement('span');
      rank.className = 'wolf-target-rank';
      rank.textContent = pad(player.slot + 1);
      const name = document.createElement('span');
      name.className = 'wolf-target-name';
      name.textContent = player.name + (player.slot === oneSync.mySlot && !oneSync.solo ? '（你）' : '');
      button.append(rank, name);
      button.addEventListener('click', () => {
        if (options.onPick) { options.onPick(player); return; }
        sendToOneHost({ type: 'act', slot: oneSync.mySlot, pick, target: player.slot });
        button.disabled = true;
        button.classList.add('is-selected');
        renderOneClient();
      });
      list.appendChild(button);
    });
    return list;
  }

  function oneRoleCard(title, roleId, subText) {
    const card = document.createElement('div');
    card.className = 'wolf-reveal';
    const emoji = document.createElement('div');
    emoji.className = 'wolf-reveal-emoji';
    emoji.textContent = oneRoleById(roleId).emoji;
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    label.textContent = title;
    const name = document.createElement('strong');
    name.className = 'wolf-client-role-name';
    name.textContent = oneRoleById(roleId).name;
    const desc = document.createElement('p');
    desc.className = 'role-desc';
    desc.textContent = subText || oneRoleById(roleId).desc;
    card.append(emoji, label, name, desc);
    return card;
  }

  function renderOneClient() {
    if (oneSync.mode !== 'client') return;
    oneClientBody.replaceChildren();
    const me = oneSync.players[oneSync.mySlot];
    if (!me) {
      const p = document.createElement('p');
      p.className = 'wolf-custom-summary';
      p.textContent = '等待主持人同步資料…';
      oneClientBody.appendChild(p);
      return;
    }
    const step = oneSync.steps[oneSync.stepIndex] || null;

    // Result screen.
    if (oneSync.over && step && step.id === 'result') {
      const reveal = document.createElement('div');
      reveal.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = oneSync.over.camp === 'village' ? '🌞' : '🐺';
      const title = document.createElement('strong');
      title.textContent = oneSync.over.camp === 'village' ? '村民獲勝' : '狼人獲勝';
      const detail = document.createElement('p');
      detail.className = 'role-desc';
      if (Number.isInteger(oneSync.over.votedSlot)) {
        const votedPlayer = oneSync.players[oneSync.over.votedSlot];
        const roleInfo = oneRoleById(votedPlayer.role);
        detail.textContent = `被投出的是 ${votedPlayer.name},最終身份是 ${roleInfo.emoji} ${roleInfo.name}。`;
      } else {
        detail.textContent = '平票或全棄權,無人被投出。';
      }
      const meRole = oneSync.players[oneSync.mySlot].role;
      const myCamp = oneRoleById(meRole).camp;
      const iWon = (oneSync.over.camp === 'village' && myCamp === 'village') || (oneSync.over.camp === 'wolf' && myCamp === 'wolf');
      const winLine = document.createElement('p');
      winLine.className = 'role-desc';
      winLine.textContent = iWon ? '🎉 你獲勝了!' : '你輸了,下局再加油!';
      const roleLine = document.createElement('p');
      roleLine.className = 'role-desc';
      const finalRole = oneRoleById(meRole);
      roleLine.textContent = `你的最終身份是 ${finalRole.emoji} ${finalRole.name}`;
      reveal.append(emoji, title, detail, winLine, roleLine);
      oneClientBody.appendChild(reveal);
      return;
    }
    if (!step) return;

    // Reveal: show my initial role.
    if (step.id === 'reveal') {
      const initialRole = me.initialRole || me.role;
      oneClientBody.appendChild(oneRoleCard('你的秘密身份', initialRole));
      oneClientBody.appendChild(oneNameEditor());
      oneClientBody.appendChild(buildGameRules('一夜狼人怎麼玩?', [
        '一晚定勝負:沒有第二晚、不會逐人,天亮投票一次就結束。',
        '夜晚角色行動:🦹 強盜換牌、🌀 搗蛋鬼交換別人、😴 失眠者確認自己的牌——天亮時你的身份可能已經被換走!',
        '投票:被投出的人現在是狼人 → 好人贏;投錯、平票或無人被投出 → 狼人贏。',
      ]));
      const action = document.createElement('div');
      action.className = 'wolf-action';
      const done = document.createElement('button');
      done.className = 'button button-primary button-large';
      done.type = 'button';
      if (me.ready) {
        done.textContent = '已確認 ✅';
        done.disabled = true;
      } else {
        done.innerHTML = '看完了,蓋牌 <span>▣</span>';
        done.addEventListener('click', () => {
          oneSync.players[oneSync.mySlot].ready = true;
          sendToOneHost({ type: 'ready', slot: oneSync.mySlot });
          renderOneClient();
        });
      }
      action.appendChild(done);
      oneClientBody.appendChild(action);
      return;
    }

    // Night: black screen unless it's my own action.
    const nightSteps = ['night-open', 'wolves', 'seer', 'robber', 'troublemaker', 'insomniac'];
    const isMyActionStep = step.target === 'client' && step.role === me.initialRole && !me.acted;

    if (nightSteps.includes(step.id) && !isMyActionStep) {
      // I already acted on this night step: show my private result.
      if (step.target === 'client' && step.role === me.initialRole && me.acted && oneSync.resultForMe) {
        const result = document.createElement('div');
        result.className = 'wolf-action';
        const h = document.createElement('h5');
        if (step.pick === 'check') {
          h.textContent = '🔮 查驗結果';
          const p = document.createElement('p');
          p.className = 'wolf-custom-summary';
          p.textContent = `${oneSync.resultForMe.targetName} 是 ${oneSync.resultForMe.isWolf ? '🐺 狼人' : '😇 好人'}`;
          result.append(h, p);
        } else if (step.pick === 'rob' || step.pick === 'self') {
          h.textContent = step.pick === 'rob' ? '🦹 你偷到的牌' : '😴 你現在的身份';
          const roleInfo = oneRoleById(oneSync.resultForMe.roleId);
          const p = document.createElement('p');
          p.className = 'wolf-custom-summary';
          p.textContent = `${roleInfo.emoji} ${roleInfo.name}`;
          result.append(h, p);
        }
        oneClientBody.appendChild(result);
        return;
      }
      const black = document.createElement('div');
      black.className = 'wolf-black';
      const text = document.createElement('span');
      text.textContent = '天黑請閉眼\n把手機蓋在桌上';
      black.appendChild(text);
      oneClientBody.appendChild(black);
      return;
    }

    // My night action.
    if (isMyActionStep) {
      const action = document.createElement('div');
      action.className = 'wolf-action';
      const heading = document.createElement('h5');
      const roleInfo = oneRoleById(step.role);
      heading.textContent = `${roleInfo.emoji} ${roleInfo.name}行動`;
      action.appendChild(heading);
      oneClientBody.appendChild(action);
      if (step.pick === 'mates') {
        const mates = oneSync.wolfMates.filter((slot) => slot !== oneSync.mySlot);
        const info = document.createElement('p');
        info.className = 'wolf-custom-summary';
        info.textContent = mates.length
          ? `你的同伴是 ${mates.map((slot) => oneSync.players[slot].name).join('、')}`
          : '你是今晚唯一的狼人。';
        action.appendChild(info);
        const done = wolfOptionButton('知道了', () => {
          oneSync.players[oneSync.mySlot].acted = true;
          sendToOneHost({ type: 'act', slot: oneSync.mySlot, pick: 'mates' });
          renderOneClient();
        });
        oneClientBody.appendChild(done);
        return;
      }
      if (step.pick === 'self') {
        const done = wolfOptionButton('確認我的身份', () => {
          oneSync.players[oneSync.mySlot].acted = true;
          sendToOneHost({ type: 'act', slot: oneSync.mySlot, pick: 'self' });
          renderOneClient();
        });
        oneClientBody.appendChild(done);
        return;
      }
      if (step.pick === 'check') {
        const targets = oneSync.players
          .map((player, index) => ({ ...player, slot: index }))
          .filter((player) => player.slot !== oneSync.mySlot);
        oneClientBody.appendChild(oneTargetList(targets, 'check'));
        return;
      }
      if (step.pick === 'rob') {
        const targets = oneSync.players
          .map((player, index) => ({ ...player, slot: index }))
          .filter((player) => player.slot !== oneSync.mySlot);
        oneClientBody.appendChild(oneTargetList(targets, 'rob'));
        return;
      }
      if (step.pick === 'swap2') {
        const note = document.createElement('p');
        note.className = 'wolf-custom-summary';
        note.textContent = '選擇兩名玩家交換身份牌(不能選自己)。';
        oneClientBody.appendChild(note);
        const list = document.createElement('div');
        list.className = 'wolf-target-list';
        oneSync.players.forEach((player, index) => {
          if (index === oneSync.mySlot) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'wolf-target' + (oneSwapPicks.includes(index) ? ' is-selected' : '');
          const rank = document.createElement('span');
          rank.className = 'wolf-target-rank';
          rank.textContent = pad(index + 1);
          const name = document.createElement('span');
          name.className = 'wolf-target-name';
          name.textContent = player.name;
          button.append(rank, name);
          button.addEventListener('click', () => {
            if (oneSwapPicks.includes(index)) oneSwapPicks = oneSwapPicks.filter((slot) => slot !== index);
            else if (oneSwapPicks.length < 2) oneSwapPicks.push(index);
            renderOneClient();
          });
          list.appendChild(button);
        });
        oneClientBody.appendChild(list);
        if (oneSwapPicks.length === 2) {
          const confirmBtn = wolfOptionButton(`交換 ${oneSwapPicks.map((slot) => oneSync.players[slot].name).join(' 和 ')}`, () => {
            sendToOneHost({ type: 'act', slot: oneSync.mySlot, pick: 'swap2', targets: [...oneSwapPicks] });
            oneSwapPicks = [];
            renderOneClient();
          });
          oneClientBody.appendChild(confirmBtn);
        }
        return;
      }
      return;
    }

    // Dawn: show my final role.
    if (step.id === 'dawn') {
      oneClientBody.appendChild(oneRoleCard('你的最終身份', me.role || me.initialRole, '角色可能已經在夜裡被換走,這是你現在的身份。'));
      return;
    }

    // Day discussion.
    if (step.id === 'discuss') {
      const card = document.createElement('div');
      card.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = oneRoleById(me.role || me.initialRole).emoji;
      const title = document.createElement('strong');
      title.textContent = `討論中 · 你現在是${oneRoleById(me.role || me.initialRole).name}`;
      const sub = document.createElement('p');
      sub.className = 'role-desc';
      sub.textContent = '角色可能被換過,討論誰現在是狼人!';
      card.append(emoji, title, sub);
      oneClientBody.appendChild(card);
      oneClientBody.appendChild(oneNameEditor());
      return;
    }

    // Vote.
    if (step.id === 'vote') {
      const card = document.createElement('div');
      card.className = 'wolf-action';
      const h = document.createElement('h5');
      h.textContent = '投票:誰現在是狼人?';
      card.appendChild(h);
      oneClientBody.appendChild(card);
      const list = document.createElement('div');
      list.className = 'wolf-target-list';
      oneSync.players.forEach((player, index) => {
        if (index === oneSync.mySlot) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wolf-target' + (oneSync.votes[oneSync.mySlot] === index ? ' is-selected' : '');
        const rank = document.createElement('span');
        rank.className = 'wolf-target-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('span');
        name.className = 'wolf-target-name';
        name.textContent = player.name;
        button.append(rank, name);
        button.addEventListener('click', () => {
          sendToOneHost({ type: 'vote', slot: oneSync.mySlot, target: index });
          renderOneClient();
        });
        list.appendChild(button);
      });
      const abstain = wolfOptionButton('棄權', () => {
        sendToOneHost({ type: 'vote', slot: oneSync.mySlot, target: null });
        renderOneClient();
      }, oneSync.votes[oneSync.mySlot] === null);
      list.appendChild(abstain);
      oneClientBody.appendChild(list);
      if (oneSync.votes[oneSync.mySlot] !== undefined) {
        const done = document.createElement('p');
        done.className = 'wolf-custom-summary';
        done.textContent = '✅ 已投票,可以修改直到主持人揭曉。';
        oneClientBody.appendChild(done);
      }
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = 'wolf-black';
    fallback.textContent = '請稍候…';
    oneClientBody.appendChild(fallback);
  }

  $('#createOneRoomButton').addEventListener('click', createOneNightRoom);
  const oneSoloWanted = initSoloToggle('onePlayMode', (solo) => {
    $('#createOneRoomButton').innerHTML = solo ? '開始離線單機局 <span>📴</span>' : '建立一夜狼人房間 <span>↗</span>';
    $('#oneOnlineCopy').hidden = solo;
    $('#oneSoloCopy').hidden = !solo;
  });
  endOneRoomButton.addEventListener('click', () => {
    resetOneNightSync();
    showToast('已結束遊戲');
  });
  oneVoiceToggle.addEventListener('change', () => {
    if (oneSync.config) oneSync.config.voice = oneVoiceToggle.checked;
  });
  oneNextButton.addEventListener('click', () => {
    if (oneSync.mode !== 'host') return;
    const step = oneSync.steps[oneSync.stepIndex] || null;
    if (!step || step.id === 'result') return;
    oneAdvance();
  });
  renderOnePresets();
  oneSetMode('local');

  // ===== 機密特務 (Codenames: secret key + clues + guesses, host + clients via PeerJS) =====
  const AGENT_HOST_PREFIX = 'pocket-agent-';
  const AGENT_THEMES = {
    mixed: { label: '通用混合', words: ['樹', '河', '山', '海', '星星', '月亮', '太陽', '火', '水', '風', '雪', '雷', '彩虹', '鑽石', '黃金', '國王', '皇后', '士兵', '醫生', '老師', '警察', '消防員', '郵差', '農夫', '歌手', '舞者'] },
    animal: { label: '動物', words: ['貓', '狗', '鳥', '魚', '馬', '牛', '羊', '蛇', '兔子', '老虎', '熊', '猴子', '雞', '鴨', '豬', '狼', '老鼠', '烏龜', '青蛙', '老鷹', '大象', '鹿', '獅子', '豹', '狐狸', '鶴'] },
    food: { label: '食物', words: ['飯', '麵', '麵包', '蛋糕', '蘋果', '香蕉', '牛奶', '咖啡', '茶', '蛋', '肉', '魚', '湯', '餃子', '披薩', '漢堡', '壽司', '火鍋', '冰淇淋', '巧克力', '餅乾', '葡萄', '西瓜', '檸檬', '洋蔥', '蒜'] },
    city: { label: '城市', words: ['香港', '東京', '巴黎', '紐約', '倫敦', '台北', '上海', '北京', '首爾', '曼谷', '雪梨', '羅馬', '柏林', '馬德里', '莫斯科', '新加坡', '深圳', '廣州', '高雄', '台中', '大阪', '京都', '米蘭', '維也納', '里斯本', '阿姆斯特丹'] },
    tech: { label: '科技', words: ['手機', '電腦', '鍵盤', '滑鼠', '螢幕', '電池', '電線', '程式', '網路', '雲端', '晶片', '機器人', '無人機', '相機', '喇叭', '耳機', '手錶', '電視', '冰箱', '洗衣機', '冷氣', '電燈', '插座', '充電器', '印表機', '掃描器'] },
    entertain: { label: '電影娛樂', words: ['超人', '蝙蝠俠', '蜘蛛人', '鋼鐵人', '海盜', '忍者', '巫師', '機器人', '外星人', '恐龍', '殭屍', '吸血鬼', '狼人', '幽靈', '公主', '王子', '巨龍', '獨角獸', '美人魚', '精靈', '巨人', '騎士', '牛仔', '法老', '小丑', '魔術師'] },
    nature: { label: '大自然', words: ['山', '河', '海', '森林', '沙漠', '草原', '冰山', '火山', '瀑布', '洞穴', '懸崖', '沼澤', '島嶼', '湖泊', '溪流', '峽谷', '平原', '溫泉', '岩石', '沙灘', '冰川', '叢林', '礁石', '彩虹', '閃電', '月亮'] },
    body: { label: '身體', words: ['眼睛', '耳朵', '鼻子', '嘴巴', '手', '腳', '心臟', '大腦', '骨頭', '皮膚', '頭髮', '牙齒', '舌頭', '肩膀', '膝蓋', '手指', '腳趾', '胃', '肝', '肺', '血液', '神經', '肌肉', '指甲', '眉毛', '嘴唇'] },
    sport: { label: '運動', words: ['籃球', '足球', '棒球', '網球', '高爾夫', '游泳', '跑步', '跳高', '拳擊', '柔道', '體操', '舉重', '射箭', '溜冰', '滑雪', '衝浪', '騎馬', '划船', '桌球', '羽球', '排球', '橄欖球', '自行車', '攀岩', '劍道', '馬拉松'] },
    music: { label: '音樂', words: ['吉他', '鋼琴', '小提琴', '鼓', '喇叭', '笛子', '古箏', '二胡', '薩克斯風', '大提琴', '口琴', '木琴', '電子琴', '麥克風', '耳機', '音響', '唱片', '演唱會', '音樂廳', '樂團', '指揮', '歌手', '作曲家', '節拍', '旋律', '和聲'] },
    job: { label: '職業', words: ['醫生', '護士', '老師', '警察', '消防員', '廚師', '律師', '法官', '記者', '編輯', '郵差', '司機', '飛行員', '船長', '農夫', '漁夫', '木匠', '水電工', '理髮師', '麵包師', '畫家', '音樂家', '演員', '舞者', '主播', '程式員'] },
    place: { label: '場所', words: ['學校', '醫院', '銀行', '郵局', '警局', '圖書館', '博物館', '美術館', '電影院', '劇場', '公園', '動物園', '植物園', '遊樂園', '體育館', '游泳池', '健身房', '超市', '市場', '百貨公司', '購物中心', '餐廳', '咖啡廳', '飯店', '機場', '火車站'] },
    vehicle: { label: '交通工具', words: ['汽車', '公車', '計程車', '機車', '腳踏車', '火車', '高鐵', '捷運', '飛機', '直升機', '船', '郵輪', '帆船', '潛水艇', '太空梭', '火箭', '熱氣球', '滑翔翼', '卡車', '貨櫃車', '救護車', '消防車', '警車', '校車', '挖土機', '起重機'] },
    country: { label: '國家', words: ['美國', '英國', '法國', '德國', '日本', '韓國', '泰國', '越南', '印度', '埃及', '希臘', '義大利', '西班牙', '葡萄牙', '荷蘭', '比利時', '瑞士', '瑞典', '挪威', '芬蘭', '丹麥', '波蘭', '俄羅斯', '巴西', '阿根廷', '加拿大'] },
  };
  const agentSync = {
    mode: 'local',      // 'local' | 'host' | 'client'
    solo: false,        // 離線單機：不連 PeerJS、不發 QR,輪流傳手機
    code: '',
    peer: null,
    conns: [],
    conn: null,
    mySlot: 0,
    ready: false,
    config: null,       // { words:[25], key:{red,blue,neutral,assassin}, voice }
    players: [],        // [{ name, team:'red'|'blue', captain, joined, ready, online }]
    steps: [],
    stepIndex: -1,
    turn: 'red',        // whose turn it is
    clue: null,         // { word, count }
    guessesLeft: 0,
    revealed: [],       // [{ index, color }]
    winner: null,       // 'red' | 'blue'
    lastReveal: null,   // { index, color, word }
    myKey: null,        // client only: key if I'm a captain
  };
  const agentSetupPanel = $('#agentSetup');
  const agentHostPanel = $('#agentHost');
  const agentClientPanel = $('#agentClient');
  const agentBadge = $('#agentBadge');
  const agentTheme = $('#agentTheme');
  const agentCustom = $('#agentCustom');
  const agentCustomWords = $('#agentCustomWords');
  const agentTeamSize = $('#agentTeamSize');
  const agentFirst = $('#agentFirst');
  const agentVoiceSelect = $('#agentVoiceSelect');
  const agentStatus = $('#agentStatus');
  const agentQrGrid = $('#agentQrGrid');
  const agentRoster = $('#agentRoster');
  const agentControl = $('#agentControl');
  const agentPhaseLabel = $('#agentPhaseLabel');
  const agentPhaseTitle = $('#agentPhaseTitle');
  const agentPhaseHint = $('#agentPhaseHint');
  const agentHostGrid = $('#agentHostGrid');
  const agentPhaseActions = $('#agentPhaseActions');
  const agentNextButton = $('#agentNextButton');
  const endAgentRoomButton = $('#endAgentRoomButton');
  const agentClientStatus = $('#agentClientStatus');
  const agentClientBody = $('#agentClientBody');
  // 離線單機狀態:發任務進度、隊長答案卡開合。
  let agentSoloDeal = { slot: 0, peeked: false };
  let agentSoloPeekTeam = null;
  function resetAgentSoloState() {
    agentSoloDeal = { slot: 0, peeked: false };
    agentSoloPeekTeam = null;
  }

  function agentSpeak(text) {
    if (!globalVoice || !agentSync.config || !agentSync.config.voice) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95;
      synth.speak(utterance);
    } catch (error) { /* voice is optional */ }
  }

  function agentColorAt(index) {
    const key = agentSync.config.key;
    if (key.assassin === index) return 'assassin';
    if (key.red.includes(index)) return 'red';
    if (key.blue.includes(index)) return 'blue';
    return 'neutral';
  }

  function agentTeamName(team) {
    return team === 'red' ? '🔴 紅隊' : '🔵 藍隊';
  }

  function agentBuildSteps() {
    return [
      { id: 'reveal', label: '發牌', title: '查看你的任務', hint: '每個人確認自己的隊伍與身份後按「看完了」。', secs: 0, voice: '每人查看自己手機上的隊伍與身份,確認後按看完了。' },
      { id: 'play', label: '遊戲進行中', title: '機密特務', hint: '', secs: 0, voice: '遊戲開始。' },
      { id: 'over', label: '遊戲結束', title: '遊戲結束', hint: '', secs: 0, voice: '遊戲結束。' },
    ];
  }

  function createAgentRoom() {
    if (agentSync.mode !== 'local') return;
    const solo = agentSoloWanted();
    if (!solo && typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      return;
    }
    const themeId = agentTheme.value;
    let bank = null;
    if (themeId === 'custom') {
      const parsed = agentCustomWords.value.split(/[\s,，、\n]+/).map((word) => word.trim()).filter(Boolean);
      bank = [...new Set(parsed)];
      if (bank.length < 25) { showToast('請輸入至少 25 個不重複的詞'); return; }
    } else {
      bank = [...((AGENT_THEMES[themeId] || AGENT_THEMES.mixed).words)];
    }
    const words = [];
    const pool = [...bank];
    while (words.length < 25 && pool.length) {
      words.push(pool.splice(randomInt(pool.length), 1)[0]);
    }
    const teamSize = clamp(Number(agentTeamSize.value) || 3, 2, 5);
    const total = teamSize * 2;
    const first = agentFirst.value === 'random' ? (Math.random() < 0.5 ? 'red' : 'blue') : agentFirst.value;
    const order = [];
    for (let i = 0; i < 9; i += 1) order.push(first);
    for (let i = 0; i < 8; i += 1) order.push(first === 'red' ? 'blue' : 'red');
    for (let i = 0; i < 7; i += 1) order.push('neutral');
    order.push('assassin');
    for (let i = order.length - 1; i > 0; i -= 1) {
      const swapIndex = randomInt(i + 1);
      [order[i], order[swapIndex]] = [order[swapIndex], order[i]];
    }
    const key = { red: [], blue: [], neutral: [], assassin: -1 };
    order.forEach((color, index) => {
      if (color === 'assassin') key.assassin = index;
      else key[color].push(index);
    });
    const roles = [{ team: 'red', captain: true }, { team: 'blue', captain: true }];
    for (let index = 2; index < total; index += 1) {
      roles.push({ team: index % 2 === 0 ? 'red' : 'blue', captain: false });
    }
    for (let index = roles.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [roles[index], roles[swapIndex]] = [roles[swapIndex], roles[index]];
    }
    const code = makeRoomCode();
    agentSync.solo = solo;
    resetAgentSoloState();
    agentSync.code = code;
    agentSync.mySlot = 0;
    agentSync.conns = [];
    agentSync.config = { words, key, voice: agentVoiceSelect.value !== '0', teamSize, first };
    agentSync.players = roles.map((role, index) => ({
      name: `玩家 ${index + 1}`,
      team: role.team,
      captain: role.captain,
      joined: solo,
      ready: false,
      online: solo,
    }));
    agentSync.steps = agentBuildSteps();
    agentSync.stepIndex = 0;
    agentSync.turn = first;
    agentSync.clue = null;
    agentSync.guessesLeft = 0;
    agentSync.revealed = [];
    agentSync.winner = null;
    agentSync.lastReveal = null;
    agentSetMode('host');
    if (solo) {
      agentBadge.textContent = '離線單機';
      agentUpdateStatus('離線單機 · 免網路、免 QR,輪流傳手機;螢幕保持常亮');
      soloKeepScreenAwake();
      agentQrGrid.hidden = true;
      agentEnterStep();
      return;
    }
    agentBadge.textContent = '房主';
    agentUpdateStatus('建立中…');
    agentQrGrid.hidden = true;
    agentPeerCreate(`${AGENT_HOST_PREFIX}${code.toLowerCase()}`);
    agentEnterStep();
  }

  function agentPeerCreate(hostId) {
    const peer = new Peer(hostId, { debug: 1 });
    agentSync.peer = peer;
    peer.on('open', () => {
      agentSync.ready = true;
      agentUpdateStatus(`房間代號 ${agentSync.code} · 等大家掃 QR 加入`);
      renderAgentQrGrid();
      renderAgentHostView();
    });
    peer.on('connection', (conn) => setupAgentHostConnection(conn));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突,請重試'); resetAgentSync(); }
      else if (type === 'invalid-id') { showToast('連線設定錯誤'); resetAgentSync(); }
      else showToast('連線暫時不穩,仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function renderAgentQrGrid() {
    agentQrGrid.replaceChildren();
    if (typeof qrcode !== 'function') {
      agentQrGrid.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    for (let slot = 1; slot <= agentSync.players.length; slot += 1) {
      const url = `${base}?${new URLSearchParams({ agent: agentSync.code, p: String(slot) }).toString()}`;
      agentQrGrid.appendChild(buildQrCard(slot, url, '掃描後查看你的隊伍與身份'));
    }
    agentQrGrid.hidden = false;
  }

  function makeAgentClientId(code, slot) {
    return `${AGENT_HOST_PREFIX}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function joinAgentRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      agentSetMode('local');
      return;
    }
    agentSync.code = code;
    agentSync.mySlot = slot;
    agentSync.conns = [];
    agentSync.players = [];
    agentSetMode('client');
    agentClientUpdateStatus(`正在連線「${code}」…`);
    const peer = new Peer(makeAgentClientId(code, slot), { debug: 1 });
    agentSync.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${AGENT_HOST_PREFIX}${code.toLowerCase()}`, { reliable: true });
      agentSync.conn = conn;
      conn.on('open', () => {
        conn.send({ type: 'hello', slot, name: `玩家 ${slot + 1}` });
      });
      conn.on('data', (message) => { try { handleAgentClientMessage(message); } catch (error) { /* ignore */ } });
      conn.on('close', () => agentClientUpdateStatus('已中斷連線,請重新掃描 QR'));
      conn.on('error', () => agentClientUpdateStatus('連線中斷,請重新掃描 QR'));
    });
    peer.on('error', () => {
      showToast('連線失敗,請確認網路');
      agentClientUpdateStatus('連線失敗,請確認網路後重新掃描');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function setupAgentHostConnection(conn) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { handleAgentHostMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => removeAgentHostConn(conn));
    conn.on('error', () => removeAgentHostConn(conn));
  }

  // 共用猜詞引擎:線上(隊員手機)與離線單機(主持人點棋盤)共用同一套翻牌/勝負邏輯。
  function agentApplyGuess(index) {
    agentSync.revealed.push({ index, color: agentColorAt(index) });
    agentSync.lastReveal = { index, color: agentColorAt(index), word: agentSync.config.words[index] };
    agentSync.guessesLeft = Math.max(0, agentSync.guessesLeft - 1);
    agentSpeak(agentRevealVoice(agentSync.lastReveal));
    const allRed = agentSync.config.key.red.every((i) => agentSync.revealed.some((entry) => entry.index === i));
    const allBlue = agentSync.config.key.blue.every((i) => agentSync.revealed.some((entry) => entry.index === i));
    if (agentColorAt(index) === 'assassin') {
      agentSync.winner = agentSync.turn === 'red' ? 'blue' : 'red';
      agentSync.turn = null;
      agentEnterOver();
    } else if (allRed) {
      agentSync.winner = 'red';
      agentSync.turn = null;
      agentEnterOver();
    } else if (allBlue) {
      agentSync.winner = 'blue';
      agentSync.turn = null;
      agentEnterOver();
    } else if (agentColorAt(index) !== agentSync.turn || agentSync.guessesLeft === 0) {
      agentSwitchTurn();
    }
    broadcastAgentState();
  }

  // 離線單機:隊員喊詞,主持人點棋盤代翻。
  function agentSoloGuess(index) {
    if (agentSync.winner) { showToast('遊戲已結束'); return; }
    if (agentSoloPeekTeam) { showToast('答案卡模式中,先收回答案卡再猜詞'); return; }
    if (!agentSync.clue) { showToast('先等隊長說提示、主持人輸入'); return; }
    if (agentSync.guessesLeft <= 0) { showToast('這回合不能再猜了,按「結束回合」換隊'); return; }
    if (agentSync.revealed.some((entry) => entry.index === index)) return;
    agentApplyGuess(index);
  }

  function handleAgentHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 1), 1, agentSync.players.length);
      if (!agentSync.players[slot - 1]) return;
      agentSync.players[slot - 1].joined = true;
      agentSync.players[slot - 1].online = true;
      if (!agentSync.conns.some((entry) => entry.conn === conn)) agentSync.conns.push({ conn, slot });
      const joined = agentSync.players.filter((player) => player.joined).length;
      agentUpdateStatus(`房間代號 ${agentSync.code} · 已加入 ${joined}/${agentSync.players.length} 人`);
      broadcastAgentState();
    } else if (message.type === 'ready') {
      const slot = clamp(Math.floor(Number(message.slot) || 1), 1, agentSync.players.length);
      if (agentSync.players[slot - 1]) {
        agentSync.players[slot - 1].ready = true;
        broadcastAgentState();
      }
    } else if (message.type === 'name') {
      const slot = clamp(Math.floor(Number(message.slot) || 1), 1, agentSync.players.length);
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${slot}`;
      if (agentSync.players[slot - 1]) {
        const oldName = agentSync.players[slot - 1].name;
        agentSync.players[slot - 1].name = name;
        if (oldName !== name) showToast(`${oldName} 改名為 ${name}`);
        broadcastAgentState();
      }
    } else if (message.type === 'guess') {
      const slot = clamp(Math.floor(Number(message.slot) || 1), 1, agentSync.players.length);
      const player = agentSync.players[slot - 1];
      if (!player || player.captain || player.team !== agentSync.turn) return;
      if (!agentSync.clue || agentSync.guessesLeft <= 0) return;
      const index = clamp(Math.floor(Number(message.index)), 0, 24);
      if (agentSync.revealed.some((entry) => entry.index === index)) return;
      agentApplyGuess(index);
    }
  }

  function agentRevealVoice(entry) {
    const word = entry.word;
    if (entry.color === 'assassin') return `猜中炸彈!${word}。遊戲結束。`;
    if (entry.color === 'neutral') return `${word}是中立詞,回合結束。`;
    if (entry.color !== agentSync.turn) return `${word}是對方${entry.color === 'red' ? '紅隊' : '藍隊'}的詞,回合結束。`;
    return `猜中了,${word}是${entry.color === 'red' ? '紅隊' : '藍隊'}的詞。`;
  }

  function agentSwitchTurn() {
    agentSync.turn = agentSync.turn === 'red' ? 'blue' : 'red';
    agentSync.clue = null;
    agentSync.guessesLeft = 0;
    agentSoloPeekTeam = null;
  }

  function agentEnterOver() {
    const overIndex = agentSync.steps.findIndex((step) => step.id === 'over');
    if (overIndex >= 0) {
      agentSync.steps[overIndex].voice = `${agentSync.winner === 'red' ? '紅隊' : '藍隊'}獲勝!`;
      agentSync.stepIndex = overIndex;
    }
    agentSoloPeekTeam = null;
    agentEnterStep();
  }

  function removeAgentHostConn(conn) {
    const before = agentSync.conns.length;
    const removed = agentSync.conns.find((entry) => entry.conn === conn);
    agentSync.conns = agentSync.conns.filter((entry) => entry.conn !== conn);
    if (removed && agentSync.players[removed.slot - 1]) agentSync.players[removed.slot - 1].online = false;
    if (agentSync.conns.length !== before) {
      const joined = agentSync.players.filter((player) => player.joined).length;
      agentUpdateStatus(`房間代號 ${agentSync.code} · 已加入 ${joined}/${agentSync.players.length} 人`);
      broadcastAgentState();
    }
  }

  function resetAgentSync() {
    try { if (agentSync.peer) agentSync.peer.destroy(); } catch (error) { /* ignore */ }
    agentSync.mode = 'local';
    agentSync.code = '';
    agentSync.peer = null;
    agentSync.conns = [];
    agentSync.conn = null;
    agentSync.mySlot = 0;
    agentSync.ready = false;
    agentSync.config = null;
    agentSync.players = [];
    agentSync.steps = [];
    agentSync.stepIndex = -1;
    agentSync.turn = 'red';
    agentSync.clue = null;
    agentSync.guessesLeft = 0;
    agentSync.revealed = [];
    agentSync.winner = null;
    agentSync.lastReveal = null;
    agentSync.myKey = null;
    if (agentSync.solo) soloAllowScreenSleep();
    agentSync.solo = false;
    resetAgentSoloState();
    agentBadge.textContent = '房主';
    agentSetMode('local');
  }

  function agentSetMode(mode) {
    agentSync.mode = mode;
    const connected = mode !== 'local';
    agentSetupPanel.hidden = connected;
    agentHostPanel.hidden = mode !== 'host';
    agentClientPanel.hidden = mode !== 'client';
    endAgentRoomButton.hidden = !connected;
    agentNextButton.hidden = mode !== 'host';
    if (!connected) {
      agentStatus.hidden = true;
      agentQrGrid.hidden = true;
      agentControl.hidden = true;
      agentHostGrid.hidden = true;
      agentPhaseActions.replaceChildren();
      agentPhaseLabel.textContent = '準備中';
      agentPhaseTitle.textContent = '等大家加入';
      agentPhaseHint.textContent = '';
      agentClientStatus.textContent = '尚未加入房間';
    } else {
      agentControl.hidden = mode !== 'host';
      if (mode === 'client') agentQrGrid.hidden = true;
      if (mode === 'host') renderAgentHostView();
      if (mode === 'client') renderAgentClient();
    }
  }

  function agentUpdateStatus(text) {
    if (agentSync.mode === 'host') {
      agentStatus.textContent = text;
      agentStatus.hidden = false;
    }
  }

  function agentClientUpdateStatus(text) {
    agentClientStatus.textContent = text;
  }

  function sendToAgentHost(message) {
    if (agentSync.conn && agentSync.conn.open) {
      try { agentSync.conn.send(message); } catch (error) { /* ignore */ }
    } else {
      showToast('尚未連上主持人');
    }
  }

  function broadcastAgentState() {
    const payload = {
      type: 'state',
      players: agentSync.players.map((player) => ({
        name: player.name,
        team: player.team,
        captain: player.captain,
        joined: player.joined,
        ready: player.ready,
        online: player.online !== false,
      })),
      stepIndex: agentSync.stepIndex,
      steps: agentSync.steps.map((step) => ({ id: step.id, label: step.label, title: step.title, hint: step.hint })),
      words: agentSync.config.words,
      key: null,
      turn: agentSync.turn,
      clue: agentSync.clue,
      guessesLeft: agentSync.guessesLeft,
      revealed: agentSync.revealed,
      winner: agentSync.winner,
      lastReveal: agentSync.lastReveal,
    };
    agentSync.conns.forEach(({ conn, slot }) => {
      const me = agentSync.players[slot - 1] || {};
      const myCopy = JSON.parse(JSON.stringify(payload));
      // The key is secret: only captains see it.
      myCopy.key = me.captain ? agentSync.config.key : null;
      try { conn.send(myCopy); } catch (error) { /* ignore */ }
    });
    renderAgentHostView();
  }

  function handleAgentClientMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state' && Array.isArray(message.players)) {
      agentSync.players = message.players.map((player) => ({
        name: validString(player.name, '玩家').trim().slice(0, 14) || '玩家',
        team: player.team === 'blue' ? 'blue' : 'red',
        captain: Boolean(player.captain),
        joined: Boolean(player.joined),
        ready: Boolean(player.ready),
        online: player.online !== false,
      }));
      agentSync.steps = message.steps || [];
      agentSync.stepIndex = message.stepIndex || 0;
      agentSync.words = message.words || [];
      agentSync.myKey = message.key || null;
      agentSync.turn = message.turn || 'red';
      agentSync.clue = message.clue || null;
      agentSync.guessesLeft = message.guessesLeft || 0;
      agentSync.revealed = message.revealed || [];
      agentSync.winner = message.winner || null;
      agentSync.lastReveal = message.lastReveal || null;
      agentSync.ready = true;
      agentClientUpdateStatus(`已連線 · 玩家 ${agentSync.mySlot}`);
      renderAgentClient();
    }
  }

  function agentEnterStep() {
    const step = agentSync.steps[agentSync.stepIndex];
    if (!step) return;
    if (step.id === 'play') {
      agentSync.turn = agentSync.config.first;
      agentSync.clue = null;
      agentSync.guessesLeft = 0;
      agentSync.revealed = [];
      agentSync.winner = null;
      agentSync.lastReveal = null;
    }
    agentSync.players.forEach((player) => { player.ready = false; });
    if (agentSync.mode === 'host') {
      const copy = agentSoloStepCopy(step);
      agentPhaseLabel.textContent = step.label || '';
      agentPhaseTitle.textContent = copy && copy.title ? copy.title : (step.title || '');
      renderAgentPhaseHint();
      renderAgentHostView();
      agentSpeak(step.voice || '');
    } else {
      renderAgentClient();
    }
    broadcastAgentState();
  }

  function renderAgentPhaseHint() {
    const step = agentSync.steps[agentSync.stepIndex] || null;
    if (!step) return;
    let text = step.hint || '';
    if (step.id === 'play' && agentSync.clue) {
      text = `提示「${agentSync.clue.word} ${agentSync.clue.count}」· 剩餘可猜 ${agentSync.guessesLeft} 個詞`;
    } else if (step.id === 'play' && agentSync.winner) {
      text = `${agentTeamName(agentSync.winner)}獲勝!`;
    } else if (step.id === 'play') {
      text = '隊長口頭說提示,主持人輸入(詞 + 數字)後,隊員開始猜詞。';
    }
    agentPhaseHint.textContent = text;
    agentPhaseHint.classList.remove('wolf-timer');
  }

  function agentBuildGrid(options = {}) {
    const { onTap, showKey, key } = options;
    const words = agentSync.words || (agentSync.config ? agentSync.config.words : []);
    const grid = document.createElement('div');
    grid.className = 'agent-grid';
    words.forEach((word, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'agent-word';
      cell.textContent = word;
      const revealedEntry = agentSync.revealed.find((entry) => entry.index === index);
      if (revealedEntry) {
        cell.classList.add(`is-${revealedEntry.color}`);
        cell.disabled = true;
      } else if (showKey && key) {
        const color = key.assassin === index ? 'assassin' : key.red.includes(index) ? 'red' : key.blue.includes(index) ? 'blue' : 'neutral';
        cell.classList.add(`is-key-${color}`);
      }
      if (onTap) {
        cell.addEventListener('click', () => onTap(index, cell));
      } else {
        // No interaction on this grid (captain's key view / host panel) — not guessable.
        cell.disabled = true;
      }
      grid.appendChild(cell);
    });
    return grid;
  }

  function renderAgentRoster() {
    agentRoster.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'list-heading';
    const left = document.createElement('span');
    const step = agentSync.steps[agentSync.stepIndex] || null;
    const stepId = step ? step.id : '';
    const ready = agentSync.players.filter((player) => player.ready).length;
    // 離線發任務中手機會傳到每個人手上,隊伍先藏起來,發完才顯示。
    const dealing = agentSync.solo && stepId === 'reveal' && agentSoloDeal.slot < agentSync.players.length;
    if (dealing) {
      left.textContent = `發任務中 · ${agentSoloDeal.slot}/${agentSync.players.length} 已看牌`;
      heading.appendChild(left);
      agentRoster.appendChild(heading);
      agentSync.players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'wolf-player';
        const rank = document.createElement('span');
        rank.className = 'wolf-player-rank';
        rank.textContent = pad(index + 1);
        const name = document.createElement('strong');
        name.className = 'wolf-player-name';
        name.textContent = player.name;
        const status = document.createElement('span');
        status.className = 'wolf-player-role';
        status.textContent = index < agentSoloDeal.slot ? '✅ 已看牌' : '🂠 待看牌';
        row.append(rank, name, status);
        agentRoster.appendChild(row);
      });
      return;
    }
    left.textContent = `玩家與身份${stepId === 'reveal' ? ` · 已確認 ${ready}/${agentSync.players.length}` : ''}`;
    heading.appendChild(left);
    agentRoster.appendChild(heading);
    agentSync.players.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'wolf-player' + (player.online === false ? ' is-dead' : '');
      const rank = document.createElement('span');
      rank.className = 'wolf-player-rank';
      rank.textContent = pad(index + 1);
      const name = document.createElement('strong');
      name.className = 'wolf-player-name';
      name.textContent = player.name + (player.online === false ? '（離線）' : '');
      const role = document.createElement('span');
      role.className = 'wolf-player-role';
      role.textContent = `${agentTeamName(player.team)} ${player.captain ? '隊長' : '隊員'}`;
      row.append(rank, name, role);
      agentRoster.appendChild(row);
    });
  }

  // 離線單機時的標題/提示文案。
  function agentSoloStepCopy(step) {
    if (!agentSync.solo || !step) return null;
    if (step.id === 'reveal') {
      return { title: '傳手機發任務', hint: '把手機輪流傳給每位玩家:看隊伍與身份(隊長會看到答案卡),蓋牌後傳下一位。' };
    }
    return null;
  }

  // ---- 離線單機:傳手機發任務 ----
  function agentSoloDealUI() {
    const total = agentSync.players.length;
    const dealt = Math.min(agentSoloDeal.slot, total);
    if (dealt >= total) {
      agentPhaseActions.appendChild(soloProgressNote(`✅ ${total} 人都看過任務了,手機交回主持人。`));
      return;
    }
    const player = agentSync.players[dealt];
    if (!agentSoloDeal.peeked) {
      agentPhaseActions.appendChild(soloProgressNote(`傳手機發任務 · 第 ${dealt + 1}/${total} 位`));
      const card = soloHandoffCard('請把手機交給', `${pad(dealt + 1)} ${player.name}`, '本人拿起手機後,點這張黑牌看任務');
      card.addEventListener('click', () => {
        agentSoloDeal.peeked = true;
        renderAgentPhaseActions();
      });
      agentPhaseActions.appendChild(card);
      return;
    }
    const reveal = document.createElement('div');
    reveal.className = 'wolf-reveal';
    const emoji = document.createElement('div');
    emoji.className = 'wolf-reveal-emoji';
    emoji.textContent = player.team === 'red' ? '🔴' : '🔵';
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    label.textContent = `${player.name} · 你的任務`;
    const title = document.createElement('strong');
    title.className = 'wolf-client-role-name';
    title.textContent = `${agentTeamName(player.team)} ${player.captain ? '隊長' : '隊員'}`;
    const desc = document.createElement('p');
    desc.className = 'role-desc';
    desc.textContent = player.captain
      ? '你是指揮官!記住下面的答案卡(紅 9 / 藍 8 / 中立 7 / 💣 炸彈 1),蓋牌後靠記憶給提示。'
      : '你是探員,看不到答案卡。聽隊長的提示猜詞,別碰炸彈!';
    reveal.append(emoji, label, title, desc);
    agentPhaseActions.appendChild(reveal);
    if (player.captain) {
      const keyNote = document.createElement('p');
      keyNote.className = 'wolf-custom-summary';
      keyNote.textContent = '⬇ 答案卡只有你看得到,記好後蓋牌!';
      agentPhaseActions.appendChild(keyNote);
      agentPhaseActions.appendChild(agentBuildGrid({ showKey: true, key: agentSync.config.key }));
    }
    agentPhaseActions.appendChild(soloNameEditor(player, dealt, () => { broadcastAgentState(); }));
    const action = document.createElement('div');
    action.className = 'wolf-action';
    const done = document.createElement('button');
    done.className = 'button button-primary button-large';
    done.type = 'button';
    done.innerHTML = dealt + 1 >= total ? '看完了,交回主持人 <span>▣</span>' : '看完了,蓋牌給下一位 <span>▣</span>';
    done.addEventListener('click', () => {
      player.ready = true;
      agentSoloDeal.slot = dealt + 1;
      agentSoloDeal.peeked = false;
      renderAgentPhaseActions();
      renderAgentRoster();
    });
    action.appendChild(done);
    agentPhaseActions.appendChild(action);
  }

  function renderAgentPhaseActions() {
    agentPhaseActions.replaceChildren();
    const step = agentSync.steps[agentSync.stepIndex] || null;
    if (!step) return;
    if (step.id === 'reveal') {
      if (agentSync.solo) {
        agentSoloDealUI();
        agentNextButton.hidden = agentSoloDeal.slot < agentSync.players.length;
        agentNextButton.innerHTML = '開始遊戲 <span>🕴️</span>';
        return;
      }
      const confirmed = agentSync.players.filter((player) => player.ready).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `已確認 ${confirmed}/${agentSync.players.length} 人。`;
      agentPhaseActions.appendChild(note);
      agentNextButton.hidden = false;
      agentNextButton.innerHTML = '開始遊戲 <span>🕴️</span>';
      return;
    }
    if (step.id === 'play' && agentSync.winner) {
      agentEnterOver();
      return;
    }
    if (step.id === 'play') {
      const turnName = agentTeamName(agentSync.turn);
      const title = document.createElement('strong');
      title.textContent = `${turnName}回合`;
      title.style.display = 'block';
      agentPhaseActions.appendChild(title);
      if (agentSync.solo) {
        // 隊長答案卡:點一下攤開(拿給該隊隊長看),再點一下收回。
        const peekRow = document.createElement('div');
        peekRow.className = 'solo-row solo-peek-row';
        ['red', 'blue'].forEach((team) => {
          const button = wolfOptionButton(
            `👁️ ${team === 'red' ? '紅' : '藍'}隊長看答案卡`,
            () => {
              agentSoloPeekTeam = agentSoloPeekTeam === team ? null : team;
              renderAgentHostView();
            },
            agentSoloPeekTeam === team,
          );
          peekRow.appendChild(button);
        });
        agentPhaseActions.appendChild(peekRow);
        if (agentSoloPeekTeam) {
          const warning = document.createElement('p');
          warning.className = 'wolf-custom-summary';
          warning.textContent = `⚠️ 答案卡模式:把手機拿給${agentSoloPeekTeam === 'red' ? '紅' : '藍'}隊長看,看完記得點按鈕收回。`;
          agentPhaseActions.appendChild(warning);
        } else {
          const how = document.createElement('p');
          how.className = 'wolf-custom-summary';
          how.textContent = '隊員喊出要猜的詞,主持人點下方棋盤代翻。';
          agentPhaseActions.appendChild(how);
        }
      }
      if (agentSync.clue) {
        const banner = document.createElement('p');
        banner.className = 'wolf-custom-summary';
        banner.textContent = `提示「${agentSync.clue.word} ${agentSync.clue.count}」· 剩餘可猜 ${agentSync.guessesLeft} 個詞`;
        agentPhaseActions.appendChild(banner);
        const last = agentSync.lastReveal;
        if (last) {
          const lastNote = document.createElement('p');
          lastNote.className = 'wolf-custom-summary';
          lastNote.textContent = `剛翻開「${last.word}」(${last.color === 'red' ? '紅隊' : last.color === 'blue' ? '藍隊' : last.color === 'neutral' ? '中立' : '💣 炸彈'})`;
          agentPhaseActions.appendChild(lastNote);
        }
        const pass = document.createElement('button');
        pass.type = 'button';
        pass.className = 'button button-quiet button-large';
        pass.textContent = '結束回合（換隊）';
        pass.addEventListener('click', () => {
          agentSwitchTurn();
          broadcastAgentState();
        });
        agentPhaseActions.appendChild(pass);
      } else {
        const wait = document.createElement('p');
        wait.className = 'wolf-custom-summary';
        wait.textContent = `${turnName} 隊長口頭說出提示(詞 + 數字),主持人輸入後隊員開始猜詞:`;
        agentPhaseActions.appendChild(wait);
        const row = document.createElement('div');
        row.className = 'agent-clue-row';
        const wordInput = document.createElement('input');
        wordInput.type = 'text';
        wordInput.maxLength = 12;
        wordInput.placeholder = '提示詞';
        wordInput.setAttribute('aria-label', '提示詞');
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '0';
        countInput.max = '9';
        countInput.value = '1';
        countInput.setAttribute('aria-label', '提示數字');
        const sendBtn = document.createElement('button');
        sendBtn.type = 'button';
        sendBtn.className = 'button button-primary';
        sendBtn.textContent = '送出提示';
        sendBtn.addEventListener('click', () => {
          const word = wordInput.value.trim().slice(0, 12);
          if (!word) { showToast('請輸入提示詞'); return; }
          agentSync.clue = { word, count: clamp(Math.floor(Number(countInput.value)), 0, 9) };
          agentSync.guessesLeft = agentSync.clue.count + 1;
          agentSpeak(`提示:${word},${agentSync.clue.count}。`);
          broadcastAgentState();
        });
        row.append(wordInput, countInput, sendBtn);
        agentPhaseActions.appendChild(row);
      }
      agentNextButton.hidden = true;
      return;
    }
    if (step.id === 'over') {
      const banner = document.createElement('div');
      banner.className = 'wolf-winner';
      banner.textContent = `${agentTeamName(agentSync.winner)}獲勝!`;
      agentPhaseActions.appendChild(banner);
      const detail = document.createElement('p');
      detail.className = 'wolf-custom-summary';
      const remaining = agentSync.config.key[agentSync.winner].filter((i) => !agentSync.revealed.some((entry) => entry.index === i));
      detail.textContent = `獲勝隊伍還剩下 ${remaining.length} 個詞未翻開。`;
      agentPhaseActions.appendChild(detail);
      agentNextButton.hidden = true;
      return;
    }
  }

  function renderAgentHostView() {
    if (agentSync.mode !== 'host') return;
    const step = agentSync.steps[agentSync.stepIndex] || null;
    if (step && (step.id === 'play' || step.id === 'over')) {
      agentHostGrid.hidden = false;
      agentHostGrid.replaceChildren();
      if (agentSync.solo) {
        if (agentSoloPeekTeam) {
          // 答案卡模式:只給該隊隊長看,其他人別看,看完收回。
          agentHostGrid.appendChild(agentBuildGrid({ showKey: true, key: agentSync.config.key }));
        } else {
          // 公開棋盤:隊員喊詞,主持人點詞代翻。
          agentHostGrid.appendChild(agentBuildGrid({ onTap: (index) => agentSoloGuess(index) }));
        }
      } else {
        agentHostGrid.appendChild(agentBuildGrid({ showKey: true, key: agentSync.config.key }));
      }
    } else {
      agentHostGrid.hidden = true;
    }
    renderAgentPhaseActions();
    renderAgentRoster();
  }

  function agentNameEditor() {
    const me = agentSync.players[agentSync.mySlot - 1];
    const wrap = document.createElement('div');
    if (!me) return wrap;
    wrap.className = 'wolf-action';
    const labelEl = document.createElement('h5');
    labelEl.textContent = '顯示名稱（主持人靠這個認人）';
    const nameInput = document.createElement('input');
    nameInput.className = 'sync-my-name';
    nameInput.type = 'text';
    nameInput.maxLength = 14;
    nameInput.value = me.name;
    nameInput.setAttribute('aria-label', '我的顯示名稱');
    nameInput.addEventListener('change', () => {
      const value = nameInput.value.trim().slice(0, 14) || `玩家 ${agentSync.mySlot}`;
      agentSync.players[agentSync.mySlot - 1].name = value;
      sendToAgentHost({ type: 'name', slot: agentSync.mySlot, name: value });
      renderAgentClient();
    });
    wrap.append(labelEl, nameInput);
    return wrap;
  }

  function renderAgentClient() {
    if (agentSync.mode !== 'client') return;
    agentClientBody.replaceChildren();
    const me = agentSync.players[agentSync.mySlot - 1];
    if (!me) {
      const p = document.createElement('p');
      p.className = 'wolf-custom-summary';
      p.textContent = '等待主持人同步資料…';
      agentClientBody.appendChild(p);
      return;
    }
    const step = agentSync.steps[agentSync.stepIndex] || null;

    // Over screen.
    if (agentSync.winner && step && step.id === 'over') {
      const reveal = document.createElement('div');
      reveal.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = agentSync.winner === 'red' ? '🔴' : '🔵';
      const title = document.createElement('strong');
      title.textContent = `${agentTeamName(agentSync.winner)}獲勝`;
      const winLine = document.createElement('p');
      winLine.className = 'role-desc';
      winLine.textContent = me.team === agentSync.winner ? '🎉 你的隊伍贏了!' : '你的隊伍輸了,下局再加油!';
      const roleLine = document.createElement('p');
      roleLine.className = 'role-desc';
      roleLine.textContent = `你是${agentTeamName(me.team)}${me.captain ? '隊長' : '隊員'}`;
      reveal.append(emoji, title, winLine, roleLine);
      agentClientBody.appendChild(reveal);
      return;
    }
    if (!step) return;

    if (step.id === 'reveal') {
      const card = document.createElement('div');
      card.className = 'wolf-reveal';
      const emoji = document.createElement('div');
      emoji.className = 'wolf-reveal-emoji';
      emoji.textContent = me.team === 'red' ? '🔴' : '🔵';
      const label = document.createElement('span');
      label.className = 'wolf-phase-label';
      label.textContent = '你的任務';
      const title = document.createElement('strong');
      title.textContent = `${agentTeamName(me.team)} ${me.captain ? '隊長' : '隊員'}`;
      const desc = document.createElement('p');
      desc.className = 'role-desc';
      desc.textContent = me.captain
        ? '你是指揮官,看得到答案卡!輪到你時,直接開口說出提示(詞 + 數字),主持人會幫你輸入。'
        : '你是探員,看不到答案卡。聽隊長的提示猜詞,別碰炸彈!';
      card.append(emoji, label, title, desc);
      agentClientBody.appendChild(card);
      if (me.captain) {
        const keyNote = document.createElement('p');
        keyNote.className = 'wolf-custom-summary';
        keyNote.textContent = '⬇ 這是答案卡,只有你看得到,別讓隊員瞄到!';
        agentClientBody.appendChild(keyNote);
        const keyGrid = document.createElement('div');
        keyGrid.className = 'agent-grid';
        agentSync.words.forEach((word, index) => {
          const cell = document.createElement('div');
          cell.className = 'agent-word';
          cell.textContent = word;
          const color = agentSync.myKey.assassin === index ? 'assassin' : agentSync.myKey.red.includes(index) ? 'red' : agentSync.myKey.blue.includes(index) ? 'blue' : 'neutral';
          cell.classList.add(`is-key-${color}`);
          keyGrid.appendChild(cell);
        });
        agentClientBody.appendChild(keyGrid);
      }
      agentClientBody.appendChild(agentNameEditor());
      agentClientBody.appendChild(buildGameRules('機密特務怎麼玩?', [
        '兩隊各一位隊長看答案卡(紅 9 / 藍 8 / 中立 7 / 炸彈 1),隊員只看得到詞。',
        '輪到你的隊伍時,隊長口頭說提示(詞 + 數字 N),隊員最多猜 N+1 個詞。',
        '猜中自己隊的詞繼續;猜中中立或對方詞換隊;猜中💣炸彈直接輸;先翻完 9 個詞的隊贏。',
      ]));
      const action = document.createElement('div');
      action.className = 'wolf-action';
      const done = document.createElement('button');
      done.className = 'button button-primary button-large';
      done.type = 'button';
      if (me.ready) {
        done.textContent = '已確認 ✅';
        done.disabled = true;
      } else {
        done.innerHTML = '看完了,出任務 <span>▣</span>';
        done.addEventListener('click', () => {
          agentSync.players[agentSync.mySlot - 1].ready = true;
          sendToAgentHost({ type: 'ready', slot: agentSync.mySlot });
          renderAgentClient();
        });
      }
      action.appendChild(done);
      agentClientBody.appendChild(action);
      return;
    }

    if (step.id === 'play') {
      const myTurn = agentSync.turn === me.team;
      const card = document.createElement('div');
      card.className = 'wolf-reveal';
      card.style.padding = '13px 14px';
      const title = document.createElement('strong');
      title.style.fontSize = '15px';
      title.textContent = `${agentTeamName(me.team)} ${me.captain ? '隊長' : '隊員'} · ${myTurn ? '你們的回合' : '等對方回合'}`;
      card.appendChild(title);
      if (agentSync.clue) {
        const clue = document.createElement('p');
        clue.className = 'role-desc';
        clue.textContent = `提示:「${agentSync.clue.word} ${agentSync.clue.count}」· 剩餘可猜 ${agentSync.guessesLeft} 個詞`;
        card.appendChild(clue);
      } else if (myTurn && me.captain) {
        const clue = document.createElement('p');
        clue.className = 'role-desc';
        clue.textContent = '輪到你給提示:看答案卡想一個詞 + 數字,然後直接說出來,主持人會幫你輸入。';
        card.appendChild(clue);
      }
      agentClientBody.appendChild(card);

      const grid = agentBuildGrid({
        showKey: me.captain,
        key: me.captain ? agentSync.myKey : null,
        onTap: me.captain ? null : (index) => {
          if (!myTurn) { showToast('還沒輪到你的隊伍'); return; }
          if (!agentSync.clue) { showToast('等隊長給提示'); return; }
          if (agentSync.guessesLeft <= 0) { showToast('這回合不能再猜了'); return; }
          if (agentSync.revealed.some((entry) => entry.index === index)) return;
          sendToAgentHost({ type: 'guess', slot: agentSync.mySlot, index });
        },
      });
      agentClientBody.appendChild(grid);
      if (me.captain) {
        const tip = document.createElement('p');
        tip.className = 'wolf-custom-summary';
        tip.textContent = '你是指揮官,不能猜詞。下方格子就是答案卡,想好提示直接開口說,主持人幫你輸入。';
        agentClientBody.appendChild(tip);
      }
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = 'wolf-black';
    fallback.textContent = '請稍候…';
    agentClientBody.appendChild(fallback);
  }

  agentTheme.addEventListener('change', () => {
    agentCustom.hidden = agentTheme.value !== 'custom';
  });
  agentVoiceSelect.addEventListener('change', () => {
    if (agentSync.config) agentSync.config.voice = agentVoiceSelect.value !== '0';
  });
  $('#createAgentRoomButton').addEventListener('click', createAgentRoom);
  const agentSoloWanted = initSoloToggle('agentPlayMode', (solo) => {
    $('#createAgentRoomButton').innerHTML = solo ? '開始離線單機局 <span>📴</span>' : '建立機密特務房間 <span>↗</span>';
    $('#agentOnlineCopy').hidden = solo;
    $('#agentSoloCopy').hidden = !solo;
  });
  endAgentRoomButton.addEventListener('click', () => {
    resetAgentSync();
    showToast('已結束遊戲');
  });
  agentNextButton.addEventListener('click', () => {
    if (agentSync.mode !== 'host') return;
    const step = agentSync.steps[agentSync.stepIndex] || null;
    if (!step) return;
    if (step.id === 'reveal') {
      agentSync.stepIndex = agentSync.steps.findIndex((entry) => entry.id === 'play');
      agentEnterStep();
    }
  });
  agentSetMode('local');

  // Countdown timer
  const timerDisplay = $('#timerDisplay');
  const timerStartButton = $('#timerStartButton');
  const timerResetButton = $('#timerResetButton');

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(state.timer.remaining);
    timerDisplay.classList.toggle('is-ending', state.timer.remaining > 0 && state.timer.remaining <= 10);
    timerStartButton.innerHTML = timerInterval ? '暫停 <span>Ⅱ</span>' : state.timer.remaining === 0 ? '再來一次 <span>▶</span>' : '開始 <span>▶</span>';
    $$('.timer-presets button').forEach((button) => button.classList.toggle('is-selected', Number(button.dataset.timerSeconds) === state.timer.preset));
  }

  function stopTimer() {
    if (timerInterval) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
    updateTimerDisplay();
  }

  function startTimer() {
    if (timerInterval) {
      stopTimer();
      return;
    }
    if (state.timer.remaining <= 0) state.timer.remaining = state.timer.preset;
    timerInterval = window.setInterval(() => {
      state.timer.remaining = Math.max(0, state.timer.remaining - 1);
      updateTimerDisplay();
      if (state.timer.remaining === 0) {
        stopTimer();
        saveState();
        vibrate([80, 60, 130]);
        showToast('時間到！');
      }
    }, 1000);
    updateTimerDisplay();
  }

  $$('.timer-presets button').forEach((button) => {
    button.addEventListener('click', () => {
      stopTimer();
      state.timer.preset = Number(button.dataset.timerSeconds);
      state.timer.remaining = state.timer.preset;
      saveState();
      updateTimerDisplay();
    });
  });
  timerStartButton.addEventListener('click', startTimer);
  timerResetButton.addEventListener('click', () => {
    stopTimer();
    state.timer.remaining = state.timer.preset;
    saveState();
    updateTimerDisplay();
  });
  updateTimerDisplay();

  // ===== 卡牌遊戲公用：牌、洗牌、加密隨機 =====
  const CARD_SUITS = ['♠', '♥', '♦', '♣'];
  const CARD_RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  const cardRankLabel = (rank) => CARD_RANK_LABELS[rank] || String(rank);
  const cardIsRed = (card) => card.suit === '♥' || card.suit === '♦';
  const cardName = (card) => `${cardRankLabel(card.rank)}${card.suit}`;

  // 加密級隨機：用 Web Crypto 的 getRandomValues，無法被預測或控制。
  function cryptoRandomInt(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  function shuffleCards(deck) {
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swap = cryptoRandomInt(index + 1);
      [deck[index], deck[swap]] = [deck[swap], deck[index]];
    }
    return deck;
  }

  let shuffleCounter = 0;

  function shuffleSeed(deck) {
    shuffleCounter = (shuffleCounter + 1) % 0xffff;
    let hash = 0;
    deck.slice(0, 40).forEach((card) => {
      hash = ((hash * 31) + card.rank * 4 + CARD_SUITS.indexOf(card.suit) + 1) >>> 0;
    });
    return (hash ^ shuffleCounter).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  }

  function buildShoe(decks = 1) {
    const deck = [];
    for (let d = 0; d < decks; d += 1) {
      CARD_SUITS.forEach((suit) => {
        for (let rank = 1; rank <= 13; rank += 1) deck.push({ suit, rank });
      });
    }
    const shuffled = shuffleCards(deck);
    return { deck: shuffled, seed: shuffleSeed(shuffled), decks };
  }

  function createCardEl(card, options = {}) {
    const el = document.createElement('div');
    if (options.down) {
      el.className = 'playing-card is-down';
      return el;
    }
    el.className = 'playing-card';
    const cornerTop = document.createElement('span');
    cornerTop.className = 'card-corner';
    cornerTop.innerHTML = `${cardRankLabel(card.rank)}<br>${card.suit}`;
    const face = document.createElement('span');
    face.className = 'card-face';
    face.textContent = card.suit;
    const cornerBottom = document.createElement('span');
    cornerBottom.className = 'card-corner corner-btm';
    cornerBottom.innerHTML = `${cardRankLabel(card.rank)}<br>${card.suit}`;
    if (cardIsRed(card)) el.classList.add('is-red');
    el.append(cornerTop, face, cornerBottom);
    return el;
  }

  function renderHand(container, cards, options = {}) {
    container.textContent = '';
    const slots = Math.max(options.slots || cards.length, options.slots || 0);
    for (let index = 0; index < slots; index += 1) {
      const card = cards[index];
      if (card) container.appendChild(createCardEl(card, options));
      else container.appendChild(document.createElement('span')).className = 'waiting-slot';
    }
  }

  function renderPlaceholders(container, slots) {
    container.textContent = '';
    for (let index = 0; index < slots; index += 1) {
      container.appendChild(document.createElement('span')).className = 'waiting-slot';
    }
  }

  function addActionButton(container, label, handler, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action-btn ${className}`.trim();
    button.textContent = label;
    button.addEventListener('click', handler);
    container.appendChild(button);
    return button;
  }

  const formatBankroll = (value) => Number(value).toLocaleString('en-US');

  // ===== 德州撲克（人機單挑） =====
  const TEXAS_SB = 5;
  const TEXAS_BB = 10;
  const TEXAS_STREET_LABELS = { idle: '準備發牌', preflop: '翻牌前', flop: '翻牌', turn: '轉牌', river: '河牌', showdown: '攤牌' };
  const HAND_NAMES = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順'];

  let texas = {
    shoe: buildShoe(1),
    street: 'idle',
    phase: 'waiting',
    community: [],
    playerCards: [],
    dealerCards: [],
    pot: 0,
    buttonOnPlayer: true,
    actor: null,
    needPlayer: false,
    needDealer: false,
    playerBet: 0,
    dealerBet: 0,
    lastBet: 0,
    playerAllIn: false,
    dealerAllIn: false,
    playerFolded: false,
    dealerFolded: false,
    handOver: true,
    reveal: false,
    showBetInput: false,
    resultMessage: '按「發牌」開始新一局',
    log: [],
    seedNote: '',
  };

  function evalFive(hand) {
    const ranks = hand.map((card) => card.rank).sort((a, b) => b - a);
    const suits = hand.map((card) => card.suit);
    const counts = {};
    ranks.forEach((rank) => { counts[rank] = (counts[rank] || 0) + 1; });
    const groups = Object.keys(counts).map((rank) => [Number(rank), counts[rank]])
      .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = suits.every((suit) => suit === suits[0]);
    let straightHigh = null;
    const unique = [...new Set(ranks)];
    if (unique.length === 5) {
      if (unique[0] - unique[4] === 4) straightHigh = unique[0];
      if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) straightHigh = 5;
    }
    if (flush && straightHigh) return [8, straightHigh];
    if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
    if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
    if (flush) return [5, ...ranks];
    if (straightHigh) return [4, straightHigh];
    if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map((group) => group[0])];
    if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
    if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map((group) => group[0])];
    return [0, ...ranks];
  }

  function compareHands(a, b) {
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const av = a[index] || 0;
      const bv = b[index] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  function bestFive(cards) {
    let best = null;
    const total = cards.length;
    const combo = [];
    const visit = (start, left) => {
      if (left === 0) {
        const value = evalFive(combo);
        if (!best || compareHands(value, best) > 0) best = value;
        return;
      }
      for (let index = start; index <= total - left; index += 1) {
        combo.push(cards[index]);
        visit(index + 1, left - 1);
        combo.pop();
      }
    };
    visit(0, 5);
    return best;
  }

  function describeHand(score) {
    if (!score) return '—';
    if (score[0] === 8 && score[1] === 5) return '同花順（A2345）';
    return HAND_NAMES[score[0]];
  }

  function texasDraw() {
    if (texas.shoe.deck.length === 0) {
      texas.shoe = buildShoe(1);
      texas.seedNote = '牌堆耗盡，已重新洗牌';
    }
    return texas.shoe.deck.pop();
  }

  function texasLogLine(text, kind = '') {
    texas.log.push({ text, kind });
    if (texas.log.length > 28) texas.log.shift();
  }

  const texasFacingCall = () => Math.max(0, texas.lastBet - texas.playerBet);
  const texasMinRaise = () => (texas.lastBet === 0 ? TEXAS_BB : texas.lastBet + TEXAS_BB);

  function texasStartHand() {
    const chips = state.cards.texas.bankroll;
    const dealerChips = state.cards.texas.dealerBankroll;
    if (chips < TEXAS_BB || dealerChips < TEXAS_BB) {
      showToast('籌碼不足 10 枚，請先「重置籌碼」');
      return;
    }
    texas.handOver = false;
    texas.reveal = false;
    texas.showBetInput = false;
    texas.seedNote = '';
    texas.community = [];
    texas.phase = 'betting';
    texas.street = 'preflop';
    texas.playerFolded = false;
    texas.dealerFolded = false;
    texas.playerAllIn = false;
    texas.dealerAllIn = false;
    texas.playerBet = 0;
    texas.dealerBet = 0;
    texas.lastBet = TEXAS_BB;
    texas.buttonOnPlayer = !texas.buttonOnPlayer;
    texas.playerCards = [texasDraw(), texasDraw()];
    texas.dealerCards = [texasDraw(), texasDraw()];
    const buttonIsPlayer = texas.buttonOnPlayer;
    const playerBlind = buttonIsPlayer ? TEXAS_SB : TEXAS_BB;
    const dealerBlind = buttonIsPlayer ? TEXAS_BB : TEXAS_SB;
    state.cards.texas.bankroll -= playerBlind;
    state.cards.texas.dealerBankroll -= dealerBlind;
    texas.pot = playerBlind + dealerBlind;
    texas.playerBet = playerBlind;
    texas.dealerBet = dealerBlind;
    texas.needPlayer = true;
    texas.needDealer = true;
    texas.actor = buttonIsPlayer ? 'player' : 'dealer';
    texas.log = [];
    texasLogLine(`新一局：${buttonIsPlayer ? '你是莊家（小盲 5）' : '你是大盲 10'}，底池 15`, '');
    saveState();
    renderTexas();
    if (texas.actor === 'dealer') window.setTimeout(texasDealerAct, 650);
  }

  function texasRefundUncalled() {
    if (texas.playerAllIn && texas.playerBet < texas.dealerBet) {
      const excess = texas.dealerBet - texas.playerBet;
      state.cards.texas.dealerBankroll += excess;
      texas.pot -= excess;
      texas.dealerBet = texas.playerBet;
    } else if (texas.dealerAllIn && texas.dealerBet < texas.playerBet) {
      const excess = texas.playerBet - texas.dealerBet;
      state.cards.texas.bankroll += excess;
      texas.pot -= excess;
      texas.playerBet = texas.dealerBet;
    }
  }

  function texasAfterAction() {
    texasRefundUncalled();
    if (texas.needPlayer && !texas.needDealer) texas.actor = 'player';
    else if (texas.needDealer) texas.actor = 'dealer';
    else texas.actor = null;
    const complete = !texas.needPlayer && !texas.needDealer && texas.playerBet === texas.dealerBet;
    if (complete || (!texas.actor && (texas.playerAllIn || texas.dealerAllIn))) {
      if (texas.playerAllIn || texas.dealerAllIn) texasRunout();
      else texasNextStreet();
      return;
    }
    renderTexas();
    if (texas.actor === 'dealer') window.setTimeout(texasDealerAct, 650);
  }

  function texasNextStreet() {
    if (texas.handOver) return;
    if (texas.playerAllIn || texas.dealerAllIn) {
      texasRunout();
      return;
    }
    if (texas.street === 'preflop') {
      texas.street = 'flop';
      texas.community.push(texasDraw(), texasDraw(), texasDraw());
      texasLogLine(`翻牌：${texas.community.map(cardName).join(' ')}`);
    } else if (texas.street === 'flop') {
      texas.street = 'turn';
      texas.community.push(texasDraw());
      texasLogLine(`轉牌：${cardName(texas.community[3])}`);
    } else if (texas.street === 'turn') {
      texas.street = 'river';
      texas.community.push(texasDraw());
      texasLogLine(`河牌：${cardName(texas.community[4])}`);
    } else {
      texasShowdown();
      return;
    }
    texas.playerBet = 0;
    texas.dealerBet = 0;
    texas.lastBet = 0;
    texas.needPlayer = !texas.playerAllIn && !texas.playerFolded;
    texas.needDealer = !texas.dealerAllIn && !texas.dealerFolded;
    texas.actor = texas.buttonOnPlayer ? 'dealer' : 'player';
    renderTexas();
    if (texas.actor === 'dealer') window.setTimeout(texasDealerAct, 650);
  }

  function texasRunout() {
    while (texas.community.length < 5) texas.community.push(texasDraw());
    texasShowdown();
  }

  function texasShowdown() {
    if (texas.handOver) return;
    texas.handOver = true;
    texas.reveal = true;
    texas.street = 'showdown';
    const playerScore = bestFive([...texas.playerCards, ...texas.community]);
    const dealerScore = bestFive([...texas.dealerCards, ...texas.community]);
    const cmp = compareHands(playerScore, dealerScore);
    let winner = 'push';
    let message = `平手：都是 ${describeHand(playerScore)}`;
    if (cmp > 0) {
      winner = 'player';
      message = `攤牌：你的 ${describeHand(playerScore)} 勝 ${describeHand(dealerScore)}`;
    } else if (cmp < 0) {
      winner = 'dealer';
      message = `攤牌：電腦的 ${describeHand(dealerScore)} 勝 ${describeHand(playerScore)}`;
    }
    texasFinishHand(winner, message, `你：「${texas.playerCards.map(cardName).join(' ')}」 電腦：「${texas.dealerCards.map(cardName).join(' ')}」`);
  }

  function texasFinishHand(winner, message, detail = '') {
    texas.handOver = true;
    texas.street = 'showdown';
    if (winner === 'player') {
      state.cards.texas.bankroll += texas.pot;
      state.cards.texas.wins += 1;
    } else if (winner === 'dealer') {
      state.cards.texas.dealerBankroll += texas.pot;
    }
    state.cards.texas.rounds += 1;
    texas.resultMessage = message;
    texasLogLine(message, winner === 'player' ? 'win' : winner === 'dealer' ? 'loss' : 'push');
    if (detail) texasLogLine(detail, '');
    saveState();
    renderTexas();
  }

  function texasPlayerFold() {
    if (texas.handOver || texas.actor !== 'player') return;
    texas.playerFolded = true;
    texas.needPlayer = false;
    texasFinishHand('dealer', '你棄牌，電腦拿下彩池');
  }

  function texasPlayerCheck() {
    if (texas.handOver || texas.actor !== 'player') return;
    texas.needPlayer = false;
    texasLogLine('你過牌');
    texasAfterAction();
  }

  function texasPlayerCall() {
    if (texas.handOver || texas.actor !== 'player') return;
    const toCall = texasFacingCall();
    if (toCall <= 0) {
      texasPlayerCheck();
      return;
    }
    const chips = state.cards.texas.bankroll;
    const amount = Math.min(toCall, chips);
    state.cards.texas.bankroll -= amount;
    texas.pot += amount;
    texas.playerBet += amount;
    texas.needPlayer = false;
    if (chips <= toCall) texas.playerAllIn = true;
    texasLogLine(`你跟注 ${amount}`);
    texasAfterAction();
  }

  function texasPlayerRaise(amount) {
    if (texas.handOver || texas.actor !== 'player' || texas.playerAllIn) return;
    const chips = state.cards.texas.bankroll;
    const isBet = texas.lastBet === 0;
    const total = clamp(Math.floor(Number(amount) || 0), texasMinRaise(), chips);
    const paid = Math.max(0, total - texas.playerBet);
    state.cards.texas.bankroll -= paid;
    texas.pot += paid;
    texas.playerBet = total;
    texas.needPlayer = false;
    texas.lastBet = total;
    if (state.cards.texas.bankroll === 0) texas.playerAllIn = true;
    texas.needDealer = !texas.dealerAllIn && !texas.dealerFolded;
    texasLogLine(`你${isBet ? '下注' : '加注到'} ${total} 枚`);
    texasAfterAction();
  }

  function texasDealerFold() {
    if (texas.handOver || texas.actor !== 'dealer') return;
    texas.dealerFolded = true;
    texas.needDealer = false;
    texasFinishHand('player', '電腦棄牌，你拿下彩池');
  }

  function texasDealerCheck() {
    if (texas.handOver || texas.actor !== 'dealer') return;
    texas.needDealer = false;
    texasLogLine('電腦過牌');
    texasAfterAction();
  }

  function texasDealerCall() {
    if (texas.handOver || texas.actor !== 'dealer') return;
    const toCall = Math.max(0, texas.lastBet - texas.dealerBet);
    const chips = state.cards.texas.dealerBankroll;
    const amount = Math.min(toCall, chips);
    state.cards.texas.dealerBankroll -= amount;
    texas.pot += amount;
    texas.dealerBet += amount;
    texas.needDealer = false;
    if (chips <= toCall) texas.dealerAllIn = true;
    texasLogLine(`電腦跟注 ${amount}`);
    texasAfterAction();
  }

  function texasDealerRaise(total) {
    if (texas.handOver || texas.actor !== 'dealer' || texas.dealerAllIn) return;
    const chips = state.cards.texas.dealerBankroll;
    const isBet = texas.lastBet === 0;
    const safeTotal = clamp(Math.floor(Number(total) || 0), texasMinRaise(), chips);
    const paid = Math.max(0, safeTotal - texas.dealerBet);
    state.cards.texas.dealerBankroll -= paid;
    texas.pot += paid;
    texas.dealerBet = safeTotal;
    texas.lastBet = safeTotal;
    texas.needDealer = false;
    if (state.cards.texas.dealerBankroll === 0) texas.dealerAllIn = true;
    texas.needPlayer = !texas.playerAllIn && !texas.playerFolded;
    texasLogLine(`電腦${isBet ? '下注' : '加注到'} ${safeTotal}`);
    texasAfterAction();
  }

  function texasDealerStrength() {
    const cards = texas.dealerCards;
    if (texas.street === 'preflop') {
      const sorted = [...cards].sort((a, b) => b.rank - a.rank);
      const [a, b] = sorted;
      if (a.rank === b.rank) return 0.82 + (a.rank / 13) * 0.1;
      if (a.rank === 14 && b.rank >= 10) return 0.72;
      if (a.rank >= 10 && b.rank >= 10) return 0.62;
      if (a.rank === 14) return 0.55;
      if (a.rank >= 10 || b.rank >= 10) return 0.46;
      if (a.suit === b.suit && Math.abs(a.rank - b.rank) <= 2) return 0.44;
      return 0.3;
    }
    const score = bestFive([...texas.dealerCards, ...texas.community]);
    const base = [0.18, 0.42, 0.6, 0.7, 0.78, 0.84, 0.92, 0.96, 0.99][score[0]];
    return base + cryptoRandomInt(100) / 1000 - 0.05;
  }

  function texasDealerAct() {
    if (texas.handOver || texas.actor !== 'dealer') return;
    const strength = texasDealerStrength();
    const toCall = Math.max(0, texas.lastBet - texas.dealerBet);
    const dealerChips = state.cards.texas.dealerBankroll;
    const minRaise = texasMinRaise();
    const canRaise = dealerChips > toCall && (toCall > 0 || dealerChips >= minRaise);

    if (toCall === 0) {
      if (strength > 0.62 && canRaise) {
        const target = Math.max(minRaise, Math.min(Math.floor(texas.pot * 0.6), dealerChips));
        texasDealerRaise(target);
      } else {
        texasDealerCheck();
      }
      return;
    }
    if (strength > 0.78 && canRaise) {
      texasDealerRaise(Math.min(dealerChips, Math.floor(texas.lastBet * 2.5)));
    } else if (strength > 0.42 || cryptoRandomInt(100) < 14) {
      texasDealerCall();
    } else {
      texasDealerFold();
    }
  }

  function renderTexas() {
    const chips = state.cards.texas.bankroll;
    const dealerChips = state.cards.texas.dealerBankroll;
    $('#texasBankroll').textContent = formatBankroll(chips);
    $('#texasPlayerChips').textContent = `${formatBankroll(chips)} 枚`;
    $('#texasDealerChips').textContent = `${formatBankroll(dealerChips)} 枚`;
    $('#texasPot').textContent = formatBankroll(texas.pot);
    $('#texasStreet').textContent = TEXAS_STREET_LABELS[texas.street] || '準備發牌';
    $('#texasDeckInfo').textContent = `🂠 ${texas.shoe.deck.length} 張 · 洗牌 #${texas.shoe.seed}`;
    $('#texasDealerLabel').textContent = `🤖 電腦莊家${texas.buttonOnPlayer ? '' : ' · 莊家'}`;
    $('#texasPlayerLabel').textContent = `🧑 你${texas.buttonOnPlayer ? ' · 莊家' : ''}`;
    $('#texasPlayerHint').textContent = texas.handOver ? '這局結束，按「發牌」開下一局' : texas.playerAllIn ? '你已全下' : '';
    $('#texasDealerHint').textContent = texas.reveal ? `攤牌：${texas.dealerCards.map(cardName).join(' ')}` : texas.seedNote || '暗牌 · 攤牌時公開';
    renderHand($('#texasDealerCards'), texas.dealerCards, { slots: 2, down: !texas.reveal });
    renderHand($('#texasPlayerCards'), texas.playerCards, { slots: 2 });
    renderHand($('#texasCommunity'), [...texas.community, null, null, null, null, null].slice(0, 5), {});

    let message = texas.resultMessage || '按「發牌」開始新一局';
    if (!texas.handOver) {
      const toCall = texasFacingCall();
      if (texas.actor === 'player') message = toCall > 0 ? `輪到你：跟注 ${toCall}、加注或棄牌` : '輪到你：過牌或下注';
      else if (texas.actor === 'dealer') message = '電腦思考中…';
      else message = '等下一條街…';
    } else if (chips < TEXAS_BB || dealerChips < TEXAS_BB) {
      message = '一方籌碼不足兩倍大盲，請按「重置籌碼」再開局';
    }
    $('#texasMessage').textContent = message;

    const actions = $('#texasActions');
    actions.textContent = '';
    if (!texas.handOver && texas.actor === 'player') {
      const toCall = texasFacingCall();
      addActionButton(actions, '棄牌', texasPlayerFold, 'is-danger');
      addActionButton(actions, toCall > 0 ? `跟注 ${toCall}` : '過牌', toCall > 0 ? texasPlayerCall : texasPlayerCheck, 'is-primary');
      if (!texas.playerAllIn) {
        addActionButton(actions, texas.lastBet === 0 ? '下注' : '加注', () => {
          texas.showBetInput = !texas.showBetInput;
          renderTexas();
        });
        addActionButton(actions, '全下', () => {
          texas.showBetInput = false;
          texasPlayerRaise(chips);
        });
      }
    }
    if (texas.showBetInput && !texas.handOver && texas.actor === 'player' && !texas.playerAllIn) {
      const row = document.createElement('div');
      row.className = 'bet-input-row';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = texasMinRaise();
      input.max = chips;
      input.value = Math.min(texasMinRaise() * 2, chips);
      input.setAttribute('aria-label', '加注金額');
      const apply = (amount) => {
        texas.showBetInput = false;
        texasPlayerRaise(amount);
      };
      const quick = (label, amount) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bet-quick';
        button.textContent = label;
        button.addEventListener('click', () => apply(amount));
        row.appendChild(button);
      };
      quick(`最小 ${texasMinRaise()}`, texasMinRaise());
      quick('半池', Math.max(texasMinRaise(), Math.floor(texas.pot * 0.5) + (texas.lastBet || 0)));
      quick('全下', chips);
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'action-btn is-primary';
      confirm.textContent = '確認';
      confirm.addEventListener('click', () => apply(Number(input.value) || texasMinRaise()));
      row.append(input, confirm);
      actions.appendChild(row);
    }

    const dealButton = $('#texasDealButton');
    dealButton.disabled = !texas.handOver || chips < TEXAS_BB || dealerChips < TEXAS_BB;
    dealButton.innerHTML = texas.handOver ? '發牌 · 下一局 <span>↗</span>' : '發牌 <span>↗</span>';

    const logEl = $('#texasLog');
    logEl.textContent = '';
    if (!texas.log.length) logEl.innerHTML = '<span class="log-empty">還沒有紀錄</span>';
    texas.log.forEach((entry) => {
      const line = document.createElement('div');
      line.className = `log-line is-${entry.kind}`;
      line.textContent = entry.text;
      logEl.appendChild(line);
    });

    const rounds = state.cards.texas.rounds;
    const wins = state.cards.texas.wins;
    const rate = rounds > 0 ? Math.round((wins / rounds) * 100) : 0;
    $('#texasStats').innerHTML = `
      <div class="stat-row"><span>已玩局數</span><strong>${rounds}</strong></div>
      <div class="stat-row"><span>你贏的局數</span><strong>${wins}</strong></div>
      <div class="stat-row"><span>勝率</span><strong>${rate}%</strong></div>
      <div class="stat-row"><span>盲注 / 起始</span><strong>5 / 10 · 1000</strong></div>
    `;
  }

  function texasResetChips() {
    state.cards.texas.bankroll = 1000;
    state.cards.texas.dealerBankroll = 1000;
    texas.handOver = true;
    texas.street = 'idle';
    texas.phase = 'waiting';
    texas.reveal = false;
    texas.showBetInput = false;
    texas.pot = 0;
    texas.log = [];
    texas.resultMessage = '雙方籌碼已重置，按「發牌」開始';
    saveState();
    renderTexas();
    showToast('雙方籌碼已重置');
  }

  $('#texasDealButton').addEventListener('click', () => {
    if (!texas.handOver) return;
    texasStartHand();
  });
  $('#texasResetButton').addEventListener('click', texasResetChips);

  // ===== 21 點（人機） =====
  let blackjack = {
    shoe: buildShoe(6),
    player: [],
    dealer: [],
    bet: 0,
    stage: 'bet', // bet | playing | over
    reveal: false,
    doubled: false,
    result: '',
    kind: '',
    history: [],
  };

  const bjDraw = () => {
    if (blackjack.shoe.deck.length === 0) blackjack.shoe = buildShoe(6);
    return blackjack.shoe.deck.pop();
  };

  function blackjackValue(hand) {
    let total = 0;
    let aces = 0;
    hand.forEach((card) => {
      total += card.rank === 1 ? 11 : Math.min(card.rank, 10);
      if (card.rank === 1) aces += 1;
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  function bjSetBet(amount) {
    if (blackjack.stage === 'playing') {
      showToast('這局進行中，先停牌再下注');
      return;
    }
    if (blackjack.stage === 'over') {
      blackjack.stage = 'bet';
      blackjack.player = [];
      blackjack.dealer = [];
      blackjack.reveal = false;
      blackjack.result = '';
      blackjack.kind = '';
      blackjack.doubled = false;
    }
    const chips = state.cards.bj.bankroll;
    blackjack.bet = amount === 'all' ? chips : Math.min(Number(amount) || 0, chips);
    renderBlackjack();
  }

  function bjDeal() {
    if (blackjack.stage !== 'bet' || blackjack.bet <= 0) return;
    const chips = state.cards.bj.bankroll;
    if (chips < blackjack.bet) {
      showToast('籌碼不足');
      return;
    }
    if (blackjack.shoe.deck.length < 52) {
      blackjack.shoe = buildShoe(6);
      blackjack.history.unshift({ text: '牌不夠，已自動重洗 6 副牌', kind: '' });
    }
    state.cards.bj.bankroll -= blackjack.bet;
    blackjack.player = [bjDraw(), bjDraw()];
    blackjack.dealer = [bjDraw(), bjDraw()];
    blackjack.stage = 'playing';
    blackjack.reveal = false;
    blackjack.doubled = false;
    blackjack.result = '';
    blackjack.kind = '';
    saveState();
    renderBlackjack();
    if (blackjackValue(blackjack.player) === 21) window.setTimeout(bjStand, 500);
  }

  function bjHit() {
    if (blackjack.stage !== 'playing') return;
    blackjack.player.push(bjDraw());
    if (blackjackValue(blackjack.player) > 21) bjResolve();
    else renderBlackjack();
  }

  function bjDouble() {
    if (blackjack.stage !== 'playing' || blackjack.player.length !== 2 || blackjack.doubled) return;
    if (state.cards.bj.bankroll < blackjack.bet) {
      showToast('籌碼不足，不能加倍');
      return;
    }
    state.cards.bj.bankroll -= blackjack.bet;
    blackjack.bet *= 2;
    blackjack.doubled = true;
    blackjack.player.push(bjDraw());
    bjResolve();
  }

  function bjStand() {
    if (blackjack.stage === 'over') return;
    blackjack.reveal = true;
    const playerBJ = blackjackValue(blackjack.player) === 21 && blackjack.player.length === 2;
    if (!playerBJ) {
      while (blackjackValue(blackjack.dealer) < 17) blackjack.dealer.push(bjDraw());
    }
    bjResolve();
  }

  function bjResolve() {
    if (blackjack.stage === 'over') return;
    blackjack.stage = 'over';
    blackjack.reveal = true;
    const player = blackjackValue(blackjack.player);
    const dealer = blackjackValue(blackjack.dealer);
    const playerBJ = player === 21 && blackjack.player.length === 2;
    const dealerBJ = dealer === 21 && blackjack.dealer.length === 2;
    let kind = 'push';
    let text = `和局：${player} : ${dealer}，下注退回`;

    if (player > 21) {
      kind = 'loss';
      text = `你爆牌（${player} 點），輸掉 ${formatBankroll(blackjack.bet)}`;
    } else if (dealer > 21) {
      state.cards.bj.bankroll += blackjack.bet * 2;
      state.cards.bj.wins += 1;
      kind = 'win';
      text = `莊家爆牌（${dealer} 點），你贏 ${formatBankroll(blackjack.bet)}`;
    } else if (playerBJ && !dealerBJ) {
      const win = Math.floor(blackjack.bet * 2.5);
      state.cards.bj.bankroll += win;
      state.cards.bj.wins += 1;
      kind = 'win';
      text = `黑傑克！你贏 ${formatBankroll(win)}（3:2）`;
    } else if (dealerBJ && !playerBJ) {
      kind = 'loss';
      text = `莊家黑傑克，你輸 ${formatBankroll(blackjack.bet)}`;
    } else if (player > dealer) {
      state.cards.bj.bankroll += blackjack.bet * 2;
      state.cards.bj.wins += 1;
      kind = 'win';
      text = `你 ${player} : ${dealer} 勝，贏 ${formatBankroll(blackjack.bet)}`;
    } else if (dealer > player) {
      kind = 'loss';
      text = `你 ${player} : ${dealer} 輸，輸掉 ${formatBankroll(blackjack.bet)}`;
    }
    state.cards.bj.rounds += 1;
    blackjack.result = text;
    blackjack.kind = kind;
    blackjack.history.unshift({ text, kind });
    if (blackjack.history.length > 24) blackjack.history.pop();
    saveState();
    renderBlackjack();
  }

  function renderBlackjack() {
    const chips = state.cards.bj.bankroll;
    $('#bjBankroll').textContent = formatBankroll(chips);
    $('#bjDeckInfo').textContent = `🂠 ${blackjack.shoe.deck.length} 張 · 洗牌 #${blackjack.shoe.seed}`;
    $('#bjBetAmount').textContent = formatBankroll(blackjack.bet);
    $('#bjPlayerTotal').textContent = blackjack.player.length ? `點數 ${blackjackValue(blackjack.player)}` : '點數 —';
    $('#bjDealerTotal').textContent = blackjack.dealer.length
      ? (blackjack.reveal ? `點數 ${blackjackValue(blackjack.dealer)}` : `點數 ${blackjackValue(blackjack.dealer.slice(0, 1))} + ?`)
      : '點數 —';
    $('#bjPlayerHint').textContent = blackjack.doubled ? '已加倍' : (blackjack.player.length === 2 && blackjackValue(blackjack.player) === 21 ? '21 點！' : '');
    $('#bjDealerHint').textContent = blackjack.reveal ? '莊家已翻牌' : '暗牌一張';
    renderHand($('#bjDealerCards'), blackjack.dealer, { slots: Math.max(2, blackjack.dealer.length), down: !blackjack.reveal });
    renderHand($('#bjPlayerCards'), blackjack.player, { slots: Math.max(2, blackjack.player.length) });

    let message = blackjack.bet > 0 ? '按「發牌」開始本局' : '先選下注金額';
    if (blackjack.stage === 'playing') message = `你 ${blackjackValue(blackjack.player)} 點：要牌、停牌，或加倍`;
    if (blackjack.stage === 'over') message = blackjack.result;
    $('#bjMessage').textContent = message;

    const pill = $('#bjResultPill');
    pill.textContent = blackjack.stage === 'over'
      ? (blackjack.kind === 'win' ? '你贏了' : blackjack.kind === 'loss' ? '你輸了' : '和局')
      : (blackjack.stage === 'playing' ? '進行中' : '下注中');

    const actions = $('#bjActions');
    actions.textContent = '';
    if (blackjack.stage === 'playing') {
      addActionButton(actions, '要牌', bjHit, 'is-primary');
      addActionButton(actions, '停牌', bjStand);
      if (blackjack.player.length === 2 && !blackjack.doubled) addActionButton(actions, '加倍 ×2', bjDouble);
    }

    $$('[data-bj-bet]').forEach((button) => {
      const selected = button.dataset.bjBet === 'all' ? blackjack.bet === chips && chips > 0 : Number(button.dataset.bjBet) === blackjack.bet;
      button.classList.toggle('is-selected', selected && blackjack.stage !== 'playing');
    });

    const dealButton = $('#bjDealButton');
    dealButton.disabled = blackjack.stage !== 'bet' || blackjack.bet <= 0 || chips < blackjack.bet;
    dealButton.innerHTML = blackjack.stage === 'over' ? '再開一局 <span>↗</span>' : '發牌 <span>↗</span>';

    const historyEl = $('#bjHistory');
    historyEl.textContent = '';
    if (!blackjack.history.length) historyEl.innerHTML = '<span class="log-empty">還沒有紀錄</span>';
    blackjack.history.forEach((entry) => {
      const line = document.createElement('div');
      line.className = `log-line is-${entry.kind}`;
      line.textContent = entry.text;
      historyEl.appendChild(line);
    });

    const rounds = state.cards.bj.rounds;
    const wins = state.cards.bj.wins;
    const rate = rounds > 0 ? Math.round((wins / rounds) * 100) : 0;
    $('#bjStats').innerHTML = `
      <div class="stat-row"><span>已玩局數</span><strong>${rounds}</strong></div>
      <div class="stat-row"><span>你贏的局數</span><strong>${wins}</strong></div>
      <div class="stat-row"><span>勝率</span><strong>${rate}%</strong></div>
      <div class="stat-row"><span>牌鞋</span><strong>6 副 · 莊 17 停</strong></div>
    `;
  }

  function bjResetChips() {
    state.cards.bj.bankroll = 1000;
    blackjack.stage = 'bet';
    blackjack.player = [];
    blackjack.dealer = [];
    blackjack.bet = 0;
    blackjack.reveal = false;
    blackjack.result = '';
    blackjack.kind = '';
    blackjack.history = [];
    saveState();
    renderBlackjack();
    showToast('籌碼已重置');
  }

  $$('[data-bj-bet]').forEach((button) => {
    button.addEventListener('click', () => bjSetBet(button.dataset.bjBet));
  });
  $('#bjDealButton').addEventListener('click', () => {
    if (blackjack.stage === 'over') {
      blackjack.stage = 'bet';
      blackjack.player = [];
      blackjack.dealer = [];
      blackjack.reveal = false;
      blackjack.result = '';
      blackjack.kind = '';
    }
    bjDeal();
  });
  $('#bjResetButton').addEventListener('click', bjResetChips);

  // ===== 百家樂（人機 · 8 副牌鞋） =====
  let baccarat = {
    shoe: buildShoe(8),
    player: [],
    banker: [],
    betSide: 'player',
    bet: 0,
    stage: 'bet', // bet | over
    result: '',
    kind: '',
    note: '',
    history: [],
  };

  const bacCardPoint = (rank) => (rank === 1 ? 1 : rank >= 10 ? 0 : rank);

  const bacDraw = () => {
    if (baccarat.shoe.deck.length < 20) {
      baccarat.shoe = buildShoe(8);
      baccarat.note = '牌剩不多，已自動重洗 8 副牌';
    }
    return baccarat.shoe.deck.pop();
  };

  const bacValue = (hand) => hand.reduce((sum, card) => (sum + bacCardPoint(card.rank)) % 10, 0);

  function bacSetBet(amount) {
    if (baccarat.stage === 'over') {
      baccarat.stage = 'bet';
      baccarat.player = [];
      baccarat.banker = [];
      baccarat.result = '';
      baccarat.kind = '';
      baccarat.note = '';
    }
    if (baccarat.stage !== 'bet') return;
    const chips = state.cards.bac.bankroll;
    baccarat.bet = amount === 'all' ? chips : Math.min(Number(amount) || 0, chips);
    renderBaccarat();
  }

  function bacSetSide(side) {
    if (baccarat.stage !== 'bet') {
      showToast('先開下一局再改押注');
      return;
    }
    baccarat.betSide = side;
    renderBaccarat();
  }

  function bacPlay() {
    if (baccarat.stage !== 'bet' || baccarat.bet <= 0) return;
    if (state.cards.bac.bankroll < baccarat.bet) {
      showToast('籌碼不足');
      return;
    }
    state.cards.bac.bankroll -= baccarat.bet;
    baccarat.stage = 'over';
    baccarat.player = [bacDraw(), bacDraw()];
    baccarat.banker = [bacDraw(), bacDraw()];
    baccarat.result = '';
    baccarat.kind = '';
    baccarat.note = '';
    let playerTotal = bacValue(baccarat.player);
    let bankerTotal = bacValue(baccarat.banker);

    if (playerTotal >= 8 || bankerTotal >= 8) {
      baccarat.note = `天生 ${Math.max(playerTotal, bankerTotal)} 點，兩邊不補牌`;
    } else {
      let third = null;
      if (playerTotal <= 5) {
        const card = bacDraw();
        baccarat.player.push(card);
        third = bacCardPoint(card.rank);
        baccarat.note = `閒家補第三張（${third} 點）`;
      } else {
        baccarat.note = '閒家 6/7 點，停牌';
      }
      const drawBanker = (() => {
        if (third === null) return bankerTotal <= 5;
        if (bankerTotal <= 2) return true;
        if (bankerTotal === 3) return third !== 8;
        if (bankerTotal === 4) return ![0, 1, 8, 9].includes(third);
        if (bankerTotal === 5) return ![0, 1, 2, 3, 8, 9].includes(third);
        if (bankerTotal === 6) return third === 6 || third === 7;
        return false;
      })();
      if (drawBanker) {
        baccarat.banker.push(bacDraw());
        baccarat.note += '；莊家補第三張';
      } else {
        baccarat.note += '；莊家不補';
      }
    }
    bacResolve();
  }

  function bacResolve() {
    const player = bacValue(baccarat.player);
    const banker = bacValue(baccarat.banker);
    const side = player === banker ? 'tie' : player > banker ? 'player' : 'banker';
    let kind = 'push';
    let text = '';
    if (side === 'tie') {
      let back = baccarat.bet;
      if (baccarat.betSide === 'tie') {
        back += baccarat.bet * 8;
        kind = 'win';
        state.cards.bac.wins += 1;
      }
      state.cards.bac.bankroll += back;
      text = baccarat.betSide === 'tie'
        ? `和局 ${player}:${banker}！押「和」贏 ${formatBankroll(baccarat.bet * 8)}（8:1）`
        : `和局 ${player}:${banker}，下注退回`;
    } else if (side === baccarat.betSide) {
      kind = 'win';
      state.cards.bac.wins += 1;
      if (side === 'player') {
        state.cards.bac.bankroll += baccarat.bet * 2;
        text = `閒贏 ${player}:${banker}，你贏 ${formatBankroll(baccarat.bet)}`;
      } else {
        state.cards.bac.bankroll += baccarat.bet + Math.floor(baccarat.bet * 0.95);
        text = `莊贏 ${player}:${banker}（5% 抽水），你贏 ${formatBankroll(Math.floor(baccarat.bet * 0.95))}`;
      }
    } else {
      kind = 'loss';
      text = `${side === 'player' ? '閒' : '莊'} 贏 ${player}:${banker}，你輸 ${formatBankroll(baccarat.bet)}`;
    }
    state.cards.bac.rounds += 1;
    baccarat.result = text;
    baccarat.kind = kind;
    baccarat.history.push(side);
    if (baccarat.history.length > 12) baccarat.history.shift();
    saveState();
    renderBaccarat();
  }

  function renderBaccarat() {
    const chips = state.cards.bac.bankroll;
    $('#bacBankroll').textContent = formatBankroll(chips);
    $('#bacDeckInfo').textContent = `🂠 ${baccarat.shoe.deck.length} 張 · 洗牌 #${baccarat.shoe.seed}`;
    $('#bacBetAmount').textContent = formatBankroll(baccarat.bet);
    $('#bacPlayerTotal').textContent = baccarat.player.length ? `點數 ${bacValue(baccarat.player)}` : '點數 —';
    $('#bacBankerTotal').textContent = baccarat.banker.length ? `點數 ${bacValue(baccarat.banker)}` : '點數 —';
    $('#bacThirdNote').textContent = baccarat.note;
    renderHand($('#bacPlayerCards'), baccarat.player, { slots: Math.max(2, baccarat.player.length) });
    renderHand($('#bacBankerCards'), baccarat.banker, { slots: Math.max(2, baccarat.banker.length) });

    $('#bacMessage').textContent = baccarat.stage === 'over'
      ? baccarat.result
      : (baccarat.bet > 0 ? '按「開牌」發牌' : '先選要押哪邊');
    const pill = $('#bacResultPill');
    pill.textContent = baccarat.stage === 'over'
      ? (baccarat.kind === 'win' ? '你贏了' : baccarat.kind === 'loss' ? '你輸了' : '和局')
      : '下注中';

    $$('[data-bac-side]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.bacSide === baccarat.betSide);
    });
    $$('[data-bac-bet]').forEach((button) => {
      const selected = button.dataset.bacBet === 'all' ? baccarat.bet === chips && chips > 0 : Number(button.dataset.bacBet) === baccarat.bet;
      button.classList.toggle('is-selected', selected);
    });

    const dealButton = $('#bacDealButton');
    dealButton.disabled = baccarat.stage !== 'bet' || baccarat.bet <= 0 || chips < baccarat.bet;
    dealButton.innerHTML = baccarat.stage === 'over' ? '再開一局 <span>↗</span>' : '開牌 <span>↗</span>';

    const routeEl = $('#bacHistory');
    routeEl.textContent = '';
    if (!baccarat.history.length) routeEl.innerHTML = '<span class="log-empty">還沒有紀錄</span>';
    baccarat.history.forEach((side) => {
      const chip = document.createElement('span');
      chip.className = `route-chip route-${side}`;
      chip.textContent = side === 'player' ? '閒' : side === 'banker' ? '莊' : '和';
      routeEl.appendChild(chip);
    });

    const rounds = state.cards.bac.rounds;
    const wins = state.cards.bac.wins;
    const rate = rounds > 0 ? Math.round((wins / rounds) * 100) : 0;
    $('#bacStats').innerHTML = `
      <div class="stat-row"><span>已玩局數</span><strong>${rounds}</strong></div>
      <div class="stat-row"><span>你押中的局數</span><strong>${wins}</strong></div>
      <div class="stat-row"><span>命中率</span><strong>${rate}%</strong></div>
      <div class="stat-row"><span>牌鞋</span><strong>8 副 · 標準補牌</strong></div>
    `;
  }

  function bacResetChips() {
    state.cards.bac.bankroll = 1000;
    baccarat.stage = 'bet';
    baccarat.player = [];
    baccarat.banker = [];
    baccarat.bet = 0;
    baccarat.result = '';
    baccarat.kind = '';
    baccarat.note = '';
    baccarat.history = [];
    saveState();
    renderBaccarat();
    showToast('籌碼已重置');
  }

  $$('[data-bac-bet]').forEach((button) => {
    button.addEventListener('click', () => bacSetBet(button.dataset.bacBet));
  });
  $$('[data-bac-side]').forEach((button) => {
    button.addEventListener('click', () => bacSetSide(button.dataset.bacSide));
  });
  $('#bacDealButton').addEventListener('click', () => {
    if (baccarat.stage === 'over') {
      baccarat.stage = 'bet';
      baccarat.player = [];
      baccarat.banker = [];
      baccarat.result = '';
      baccarat.kind = '';
      baccarat.note = '';
    }
    bacPlay();
  });
  $('#bacResetButton').addEventListener('click', bacResetChips);

  // ===== 多人卡牌房間（PeerJS · QR · 莊家手機發牌） =====
  function makeCardClientId(prefix, code, slot) {
    return `${prefix}${code.toLowerCase()}-${slot}-${randomInt(100000)}${Date.now() % 1000}`;
  }

  function cardRoomSend(conn, message) {
    if (conn && conn.open) {
      try { conn.send(message); } catch (error) { /* ignore */ }
    }
  }

  function cardRoomBroadcast(conns, message) {
    conns.forEach((entry) => cardRoomSend(entry.conn, message));
  }

  function cardRoomSetupHostConn(conn, onMessage, onClose) {
    conn.on('open', () => {
      conn.on('data', (message) => { try { onMessage(conn, message); } catch (error) { /* ignore */ } });
    });
    conn.on('close', () => onClose(conn));
    conn.on('error', () => onClose(conn));
  }

  function cardRoomRemoveConn(conns, conn) {
    const removed = conns.find((entry) => entry.conn === conn);
    const next = conns.filter((entry) => entry.conn !== conn);
    return { conns: next, removed };
  }

  function cardRoomBuildQr(gridEl, param, code, slots, subLabel) {
    gridEl.replaceChildren();
    if (typeof qrcode !== 'function') {
      gridEl.hidden = true;
      return;
    }
    const base = `${window.location.origin}${window.location.pathname}`;
    slots.forEach((slot) => {
      const url = `${base}?${new URLSearchParams({ [param]: code, p: String(slot) }).toString()}`;
      gridEl.appendChild(buildQrCard(slot - 1, url, subLabel));
    });
    gridEl.hidden = false;
  }

  function makeRoomPlayer(slot, index) {
    return {
      slot,
      name: `玩家 ${slot}`,
      chips: 1000,
      bet: 0,
      committed: 0,
      folded: false,
      allIn: false,
      streetActed: false,
      inHand: false,
      joined: false,
      online: false,
      locked: false,
      side: 'player',
      cards: [],
      doubled: false,
      finished: false,
      result: '',
      lastResult: '',
    };
  }

  // ---------- 德州撲克 · 多人 ----------
  const TEXAS_ROOM_HOST = 'pocket-texas-';
  const texasRoom = {
    mode: 'local', code: '', peer: null, conns: [], conn: null, mySlot: 0, ready: false,
    players: [], handNo: 0, street: 'idle', community: [], pot: 0, lastBet: 0,
    actor: null, buttonSlot: null, revealed: false, seed: '', deck: [],
    log: [], winnerText: '', handOver: true, nameDraft: '',
  };
  const texasOnlineWanted = initSoloToggle('texasPlayMode', (soloOn) => {
    // soloOn = true 表示「單機人機」；false = 多人連線
    if (!soloOn && texasRoom.mode === 'local') {
      $('#texasRoom').hidden = false;
      $('#texasSolo').hidden = true;
    } else if (soloOn && texasRoom.mode === 'local') {
      $('#texasRoom').hidden = true;
      $('#texasSolo').hidden = false;
    }
    if (texasRoom.mode === 'host' || texasRoom.mode === 'client') {
      $('#texasRoom').hidden = false;
      $('#texasSolo').hidden = true;
    }
  });

  function texasRoomSetMode(mode) {
    texasRoom.mode = mode;
    const connected = mode !== 'local';
    $('#texasRoom').hidden = !connected;
    $('#texasSolo').hidden = connected;
    $('#texasRoomBadge').textContent = mode === 'host' ? '莊家' : mode === 'client' ? '已連線' : '本機';
    $('#endTexasRoomButton').hidden = !connected;
    if (!connected) {
      $('#texasRoomStatus').hidden = true;
      $('#texasQrGrid').hidden = true;
      $('#texasRoomIdle').hidden = true;
    } else {
      $('#texasRoomIdle').hidden = mode !== 'host';
    }
    if (mode === 'host') renderTexasRoomStage();
    if (mode === 'client') renderTexasClient();
    if (connected) {
      $$('#texasPlayMode .solo-mode-option').forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.playmode === 'online');
      });
    }
  }

  function texasRoomPlayersCount() {
    return clamp(Math.floor(Number($('#texasRoomPlayers').value) || 4), 2, 8);
  }

  function texasRoomLogLine(text, kind = '') {
    texasRoom.log.push({ text, kind });
    if (texasRoom.log.length > 40) texasRoom.log.shift();
  }

  function texasRoomFacing(p) {
    return Math.max(0, texasRoom.lastBet - p.bet);
  }

  function texasRoomActivePlayers() {
    return texasRoom.players.filter((p) => p.inHand && !p.folded && !p.allIn);
  }

  function texasRoomJoinedNames() {
    return texasRoom.players.filter((p) => p.joined).map((p) => p.name);
  }

  function texasRoomBroadcast() {
    const base = {
      type: 'state',
      stage: texasRoom.handOver ? (texasRoom.revealed ? 'showdown' : 'idle') : 'playing',
      handNo: texasRoom.handNo,
      street: texasRoom.street,
      community: texasRoom.community,
      pot: texasRoom.pot,
      lastBet: texasRoom.lastBet,
      actor: texasRoom.actor,
      buttonSlot: texasRoom.buttonSlot,
      revealed: texasRoom.revealed,
      seed: texasRoom.seed,
      winnerText: texasRoom.winnerText,
      log: texasRoom.log.slice(-14),
      players: texasRoom.players.map((p) => ({
        slot: p.slot, name: p.name, chips: p.chips, bet: p.bet,
        folded: p.folded, allIn: p.allIn, joined: p.joined, online: p.online !== false,
        inHand: p.inHand,
      })),
    };
    texasRoom.conns.forEach((entry) => {
      const me = texasRoom.players.find((p) => p.slot === entry.slot);
      cardRoomSend(entry.conn, { ...base, myCards: me ? me.cards : [] });
    });
    renderTexasRoomStage();
  }

  function texasRoomHandStart() {
    const joined = texasRoom.players.filter((p) => p.joined);
    if (joined.length < 2) {
      showToast('至少 2 位牌手加入才能開局');
      return;
    }
    texasRoom.handNo += 1;
    texasRoom.handOver = false;
    texasRoom.revealed = false;
    texasRoom.winnerText = '';
    texasRoom.community = [];
    texasRoom.street = 'preflop';
    texasRoom.seed = '';
    texasRoom.deck = buildShoe(1).deck;
    texasRoom.seed = shuffleSeed(texasRoom.deck.slice());
    texasRoom.players.forEach((p) => {
      p.cards = [];
      p.bet = 0;
      p.committed = 0;
      p.folded = false;
      p.allIn = false;
      p.streetActed = false;
      p.inHand = p.joined;
    });
    const order = joined.map((p) => p.slot);
    let buttonIndex = order.indexOf(texasRoom.buttonSlot);
    buttonIndex = (buttonIndex + 1) % order.length;
    texasRoom.buttonSlot = order[buttonIndex];
    const sbSlot = order[(buttonIndex + 1) % order.length];
    const bbSlot = order[(buttonIndex + 2) % order.length];
    const sb = texasRoom.players.find((p) => p.slot === sbSlot);
    const bb = texasRoom.players.find((p) => p.slot === bbSlot);
    texasRoom.players.forEach((p) => {
      if (!p.inHand) return;
      p.cards = [texasRoom.deck.pop(), texasRoom.deck.pop()];
    });
    const sbPaid = Math.min(TEXAS_SB, sb.chips);
    sb.chips -= sbPaid;
    sb.bet += sbPaid;
    sb.committed += sbPaid;
    if (sb.chips <= 0) sb.allIn = true;
    const bbPaid = Math.min(TEXAS_BB, bb.chips);
    bb.chips -= bbPaid;
    bb.bet += bbPaid;
    bb.committed += bbPaid;
    if (bb.chips <= 0) bb.allIn = true;
    texasRoom.lastBet = TEXAS_BB;
    texasRoom.pot = sbPaid + bbPaid;
    texasRoom.log = [];
    texasRoomLogLine(`第 ${texasRoom.handNo} 局開始 · ${sb.name} 小盲 5 · ${bb.name} 大盲 10`, '');
    const active = texasRoom.players.filter((p) => p.inHand && !p.folded && !p.allIn).map((p) => p.slot);
    if (!active.length) {
      texasRoom.handOver = true;
      texasRoom.winnerText = '本局無效：沒有人可行動';
      texasRoomBroadcast();
      return;
    }
    const utgIndex = active.indexOf(bbSlot);
    texasRoom.actor = active[(utgIndex + 1) % active.length];
    texasRoomBroadcast();
  }

  function texasRoomNextStreet() {
    if (texasRoom.handOver) return;
    if (texasRoomMaybeEndByFold()) return;
    const alive = texasRoom.players.filter((p) => p.inHand && !p.folded);
    if (alive.length <= 1) {
      if (alive.length === 1) {
        const winner = alive[0];
        winner.chips += texasRoom.pot;
        texasRoom.handOver = true;
        texasRoom.revealed = false;
        texasRoom.winnerText = `${winner.name} 全場棄牌，贏得 ${formatBankroll(texasRoom.pot)}`;
        texasRoomLogLine(texasRoom.winnerText, 'win');
        texasRoom.pot = 0;
        texasRoomBroadcast();
      }
      return;
    }
    if (texasRoom.street === 'preflop') {
      texasRoom.street = 'flop';
      texasRoom.community.push(texasRoom.deck.pop(), texasRoom.deck.pop(), texasRoom.deck.pop());
      texasRoomLogLine(`翻牌：${texasRoom.community.map(cardName).join(' ')}`);
    } else if (texasRoom.street === 'flop') {
      texasRoom.street = 'turn';
      texasRoom.community.push(texasRoom.deck.pop());
      texasRoomLogLine(`轉牌：${cardName(texasRoom.community[3])}`);
    } else if (texasRoom.street === 'turn') {
      texasRoom.street = 'river';
      texasRoom.community.push(texasRoom.deck.pop());
      texasRoomLogLine(`河牌：${cardName(texasRoom.community[4])}`);
    } else {
      texasRoomSettle();
      return;
    }
    texasRoom.players.forEach((p) => {
      p.bet = 0;
      p.streetActed = false;
    });
    texasRoom.lastBet = 0;
    const active = texasRoom.players.filter((p) => p.inHand && !p.folded && !p.allIn).map((p) => p.slot);
    if (!active.length) {
      texasRoomRunout();
      return;
    }
    const idx = active.indexOf(texasRoom.buttonSlot);
    texasRoom.actor = active[(idx + 1) % active.length];
    texasRoomBroadcast();
  }

  function texasRoomMaybeEndByFold() {
    const alive = texasRoom.players.filter((p) => p.inHand && !p.folded);
    if (alive.length > 1) return false;
    if (alive.length === 1) {
      const winner = alive[0];
      winner.chips += texasRoom.pot;
      texasRoom.handOver = true;
      texasRoom.revealed = false;
      texasRoom.winnerText = `${winner.name} 全場棄牌，贏得 ${formatBankroll(texasRoom.pot)}`;
      texasRoomLogLine(texasRoom.winnerText, 'win');
      texasRoom.pot = 0;
      texasRoomBroadcast();
      return true;
    }
    texasRoom.handOver = true;
    texasRoom.revealed = false;
    texasRoom.winnerText = '本局無效：全場棄牌';
    texasRoom.pot = 0;
    texasRoomBroadcast();
    return true;
  }

  function texasRoomRunout() {
    // 所有人已全下：直接把剩餘公共牌開完再結算（支援邊池）。
    while (texasRoom.community.length < 5) texasRoom.community.push(texasRoom.deck.pop());
    texasRoomSettle();
  }

  function texasRoomAdvance() {
    if (texasRoomMaybeEndByFold()) return;
    const order = texasRoom.players.filter((p) => p.inHand).map((p) => p.slot);
    if (!order.length) return;
    let idx = order.indexOf(texasRoom.actor);
    for (let step = 0; step < order.length; step += 1) {
      idx = (idx + 1) % order.length;
      const p = texasRoom.players.find((x) => x.slot === order[idx]);
      if (p && p.inHand && !p.folded && !p.allIn && (!p.streetActed || p.bet < texasRoom.lastBet)) {
        texasRoom.actor = p.slot;
        texasRoomBroadcast();
        return;
      }
    }
    const anyAllIn = texasRoom.players.some((p) => p.inHand && !p.folded && p.allIn);
    if (anyAllIn && texasRoom.community.length < 5) {
      texasRoomRunout();
      return;
    }
    texasRoomNextStreet();
  }

  function texasRoomApplyAct(slot, action, amount) {
    if (texasRoom.handOver || texasRoom.actor !== slot) return;
    const p = texasRoom.players.find((x) => x.slot === slot);
    if (!p || !p.inHand || p.folded || p.allIn) return;
    const toCall = texasRoomFacing(p);
    if (action === 'fold') {
      p.folded = true;
      p.streetActed = true;
      texasRoomLogLine(`${p.name} 棄牌`, '');
    } else if (action === 'check') {
      if (toCall > 0) return;
      p.streetActed = true;
      texasRoomLogLine(`${p.name} 過牌`, '');
    } else if (action === 'call') {
      if (toCall <= 0) {
        p.streetActed = true;
        texasRoomLogLine(`${p.name} 過牌`, '');
      } else {
        const paid = Math.min(toCall, p.chips);
        p.chips -= paid;
        p.bet += paid;
        p.committed += paid;
        texasRoom.pot += paid;
        p.streetActed = true;
        if (p.chips <= 0) p.allIn = true;
        texasRoomLogLine(`${p.name} 跟注 ${paid}${p.allIn ? '（全下）' : ''}`, '');
      }
    } else if (action === 'allin') {
      if (p.chips <= 0) return;
      const paid = p.chips;
      p.chips -= paid;
      p.bet += paid;
      p.committed += paid;
      texasRoom.pot += paid;
      p.allIn = true;
      p.streetActed = true;
      texasRoom.lastBet = Math.max(texasRoom.lastBet, p.bet);
      texasRoomLogLine(`${p.name} 全下 ${p.bet}`, '');
    } else if (action === 'raise') {
      const chips = p.chips;
      const minRaise = texasRoom.lastBet === 0 ? TEXAS_BB : texasRoom.lastBet + TEXAS_BB;
      let total = clamp(Math.floor(Number(amount) || 0), minRaise, p.bet + chips);
      if (total > p.bet + chips) total = p.bet + chips;
      const paid = total - p.bet;
      p.chips -= paid;
      p.bet = total;
      p.committed += paid;
      texasRoom.pot += paid;
      p.streetActed = true;
      texasRoom.lastBet = total;
      if (p.chips <= 0) p.allIn = true;
      texasRoomLogLine(`${p.name} ${texasRoom.lastBet === p.bet && texasRoom.lastBet > TEXAS_BB ? '加注到' : '下注'} ${total}${p.allIn ? '（全下）' : ''}`, '');
    }
    texasRoomAdvance();
  }

  function texasRoomSettle() {
    const alive = texasRoom.players.filter((p) => p.inHand && !p.folded);
    const inHand = texasRoom.players.filter((p) => p.inHand);
    const levels = [...new Set(inHand.map((p) => p.committed).filter((bet) => bet > 0))].sort((a, b) => a - b);
    let prev = 0;
    const potTotal = texasRoom.pot;
    let paid = 0;
    const payouts = {};
    levels.forEach((level) => {
      const slice = (level - prev) * inHand.filter((p) => p.committed >= level).length;
      paid += slice;
      const eligible = alive.filter((p) => p.committed >= level);
      let winners = [];
      let best = null;
      eligible.forEach((p) => {
        const score = bestFive([...p.cards, ...texasRoom.community]);
        if (!best || compareHands(score, best) > 0) {
          best = score;
          winners = [p];
        } else if (best && compareHands(score, best) === 0) {
          winners.push(p);
        }
      });
      const share = Math.floor(slice / winners.length);
      let remainder = slice - share * winners.length;
      winners.forEach((p) => {
        payouts[p.slot] = (payouts[p.slot] || 0) + share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      });
      prev = level;
    });
    const total = Object.values(payouts).reduce((sum, v) => sum + v, 0);
    if (total < potTotal && potTotal > 0) {
      const leftover = potTotal - total;
      const top = alive[0];
      if (top) payouts[top.slot] = (payouts[top.slot] || 0) + leftover;
    }
    const names = [];
    Object.keys(payouts).forEach((key) => {
      const slot = Number(key);
      const p = texasRoom.players.find((x) => x.slot === slot);
      if (p) {
        p.chips += payouts[slot];
        names.push(`${p.name} +${formatBankroll(payouts[slot])}`);
      }
    });
    texasRoom.handOver = true;
    texasRoom.revealed = true;
    texasRoom.winnerText = `攤牌 · ${names.join('、') || '平局'}`;
    const best = texasRoom.players.reduce((winner, p) => {
      if (!p.inHand || p.folded || !winner) return p;
      const score = bestFive([...p.cards, ...texasRoom.community]);
      const winnerScore = bestFive([...winner.cards, ...texasRoom.community]);
      return compareHands(score, winnerScore) >= 0 ? p : winner;
    }, null);
    if (best) texasRoomLogLine(`最佳牌型 ${describeHand(bestFive([...best.cards, ...texasRoom.community]))} · ${texasRoom.winnerText}`, 'win');
    texasRoom.pot = 0;
    texasRoomBroadcast();
  }

  function renderTexasRoomStage() {
    const stage = $('#texasRoomStage');
    stage.replaceChildren();
    const header = document.createElement('div');
    header.className = 'room-row-head';
    const title = document.createElement('strong');
    title.textContent = texasRoom.handNo > 0 ? `第 ${texasRoom.handNo} 局 · ${TEXAS_STREET_LABELS[texasRoom.street] || '準備中'}` : '等待開局';
    const info = document.createElement('span');
    info.textContent = `底池 ${formatBankroll(texasRoom.pot)} · 洗牌 #${texasRoom.seed || '—'}`;
    header.append(title, info);
    stage.appendChild(header);

    const community = document.createElement('div');
    community.className = 'room-cards';
    const communityCards = [...texasRoom.community];
    while (communityCards.length < 5) communityCards.push(null);
    communityCards.forEach((card) => {
      if (card) community.appendChild(createCardEl(card)); else { const slot = document.createElement('span'); slot.className = 'waiting-slot'; community.appendChild(slot); }
    });
    stage.appendChild(community);

    const table = document.createElement('div');
    table.className = 'card-room-table';
    texasRoom.players.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'room-row-head';
      const name = document.createElement('strong');
      name.textContent = `${p.joined ? p.name : `（未加入）玩家 ${p.slot}`}${p.slot === texasRoom.buttonSlot ? ' 🎩' : ''}${p.slot === texasRoom.actor ? ' ▶' : ''}`;
      const status = document.createElement('span');
      status.textContent = !p.joined ? '等待加入' : !p.inHand ? '未入局' : p.folded ? '已棄牌' : p.allIn ? '全下' : p.slot === texasRoom.actor ? `行動中 · 需跟注 ${texasRoomFacing(p)}` : `${formatBankroll(p.chips)} 枚 · 本局 ${p.bet}`;
      row.append(name, status);
      const cards = document.createElement('div');
      cards.className = 'room-cards';
      if (p.inHand && texasRoom.revealed) {
        p.cards.forEach((card) => cards.appendChild(createCardEl(card)));
      } else if (p.inHand) {
        p.cards.forEach(() => cards.appendChild(createCardEl(null, { down: true })));
      }
      row.appendChild(cards);
      table.appendChild(row);
    });
    stage.appendChild(table);

    const note = document.createElement('p');
    note.className = 'room-note';
    note.textContent = texasRoom.winnerText || (texasRoom.handOver ? '按「開始下一局」發牌；所有牌手每人 1000 枚籌碼。' : '莊家手機發牌中，牌手在自己的手機上行動。');
    stage.appendChild(note);

    const logEl = document.createElement('div');
    logEl.className = 'round-log';
    texasRoom.log.slice(-8).forEach((entry) => {
      const line = document.createElement('div');
      line.className = `log-line is-${entry.kind}`;
      line.textContent = entry.text;
      logEl.appendChild(line);
    });
    stage.appendChild(logEl);

    const actions = document.createElement('div');
    actions.className = 'client-actions';
    if (texasRoom.handOver) {
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'action-btn is-primary';
      start.textContent = '開始下一局';
      start.addEventListener('click', texasRoomHandStart);
      actions.appendChild(start);
    }
    stage.appendChild(actions);
  }

  function renderTexasClient() {
    const stage = $('#texasRoomStage');
    stage.replaceChildren();
    const me = texasRoom.players.find((p) => p.slot === texasRoom.mySlot);
    if (!texasRoom.ready || !me) {
      const wait = document.createElement('div');
      wait.className = 'room-waiting';
      wait.innerHTML = '<strong>正在連線莊家…</strong><span>若一直停在這，請確認莊家手機已建立房間且網路正常。</span>';
      stage.appendChild(wait);
      return;
    }
    const head = document.createElement('div');
    head.className = 'room-row-head';
    const title = document.createElement('strong');
    title.textContent = `德州撲克 · ${texasRoom.handNo > 0 ? `第 ${texasRoom.handNo} 局` : '等待開局'}`;
    const info = document.createElement('span');
    info.textContent = `你 ${formatBankroll(me.chips)} 枚 · 底池 ${formatBankroll(texasRoom.pot)}`;
    head.append(title, info);
    stage.appendChild(head);

    const myCards = document.createElement('div');
    myCards.className = 'hand-cards';
    (me.cards || []).forEach((card) => myCards.appendChild(createCardEl(card)));
    stage.appendChild(myCards);

    const community = document.createElement('div');
    community.className = 'community-row';
    const communityCards = [...texasRoom.community];
    while (communityCards.length < 5) communityCards.push(null);
    communityCards.forEach((card) => { if (card) community.appendChild(createCardEl(card)); else { const slot = document.createElement('span'); slot.className = 'waiting-slot'; community.appendChild(slot); } });
    stage.appendChild(community);

    const myStatus = document.createElement('p');
    myStatus.className = 'room-note';
    if (texasRoom.revealed) myStatus.textContent = texasRoom.winnerText || '攤牌';
    else if (!me.inHand) myStatus.textContent = '你還沒加入本局，下一局莊家會把你排進去。';
    else if (me.folded) myStatus.textContent = '你已棄牌，看大家玩完這局。';
    else if (me.allIn) myStatus.textContent = '你已全下，等攤牌。';
    else if (texasRoom.actor === me.slot) myStatus.textContent = `輪到你：跟注 ${texasRoomFacing(me)} 或過牌`;
    else myStatus.textContent = `等待 ${(texasRoom.players.find((p) => p.slot === texasRoom.actor) || {}).name || '…'} 行動`;
    stage.appendChild(myStatus);

    if (!texasRoom.handOver && texasRoom.actor === me.slot && me.inHand && !me.folded && !me.allIn) {
      const actions = document.createElement('div');
      actions.className = 'client-actions';
      const toCall = texasRoomFacing(me);
      const fold = document.createElement('button');
      fold.type = 'button';
      fold.className = 'action-btn is-danger';
      fold.textContent = '棄牌';
      fold.addEventListener('click', () => cardRoomSend(texasRoom.conn, { type: 'act', action: 'fold' }));
      const call = document.createElement('button');
      call.type = 'button';
      call.className = 'action-btn is-primary';
      call.textContent = toCall > 0 ? `跟注 ${toCall}` : '過牌';
      call.addEventListener('click', () => cardRoomSend(texasRoom.conn, { type: 'act', action: toCall > 0 ? 'call' : 'check' }));
      const raise = document.createElement('button');
      raise.type = 'button';
      raise.className = 'action-btn';
      raise.textContent = texasRoom.lastBet === 0 ? '下注' : '加注';
      raise.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'bet-input-row';
        const input = document.createElement('input');
        input.type = 'number';
        const minRaise = texasRoom.lastBet === 0 ? TEXAS_BB : texasRoom.lastBet + TEXAS_BB;
        input.min = minRaise;
        input.max = me.bet + me.chips;
        input.value = Math.min(minRaise * 2, me.bet + me.chips);
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'action-btn is-primary';
        confirm.textContent = '確認';
        confirm.addEventListener('click', () => cardRoomSend(texasRoom.conn, { type: 'act', action: 'raise', amount: Number(input.value) || minRaise }));
        const allin = document.createElement('button');
        allin.type = 'button';
        allin.className = 'bet-quick';
        allin.textContent = '全下';
        allin.addEventListener('click', () => cardRoomSend(texasRoom.conn, { type: 'act', action: 'allin' }));
        row.append(input, confirm, allin);
        stage.replaceChild(row, actions);
      });
      const allin = document.createElement('button');
      allin.type = 'button';
      allin.className = 'action-btn';
      allin.textContent = '全下';
      allin.addEventListener('click', () => cardRoomSend(texasRoom.conn, { type: 'act', action: 'allin' }));
      actions.append(fold, call, raise, allin);
      stage.appendChild(actions);
    }
  }

  function handleTexasRoomHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    const p = texasRoom.players.find((x) => x.slot === conn.slot);
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 1, texasRoom.players.length);
      conn.slot = slot;
      const player = texasRoom.players.find((x) => x.slot === slot);
      const name = validString(message.name, '').trim().slice(0, 14);
      if (player) {
        player.joined = true;
        player.online = true;
        if (name) player.name = name;
      }
      if (!texasRoom.conns.some((entry) => entry.conn === conn)) texasRoom.conns.push({ conn, slot });
      const joined = texasRoom.players.filter((x) => x.joined).length;
      $('#texasRoomStatus').textContent = `房間代號 ${texasRoom.code} · 已加入 ${joined}/${texasRoom.players.length} 人`;
      $('#texasRoomStatus').hidden = false;
      texasRoomBroadcast();
    } else if (message.type === 'name' && p) {
      const name = validString(message.name, '').trim().slice(0, 14) || `玩家 ${p.slot}`;
      p.name = name;
      texasRoomBroadcast();
    } else if (message.type === 'act') {
      texasRoomApplyAct(conn.slot, message.action, Number(message.amount));
    }
  }

  function createTexasRoom() {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    const count = texasRoomPlayersCount();
    const code = makeRoomCode();
    texasRoom.code = code;
    texasRoom.mySlot = 0;
    texasRoom.conns = [];
    texasRoom.players = Array.from({ length: count }, (_, index) => makeRoomPlayer(index + 1, index));
    texasRoom.handNo = 0;
    texasRoom.handOver = true;
    texasRoom.revealed = false;
    texasRoom.street = 'idle';
    texasRoom.pot = 0;
    texasRoom.log = [];
    texasRoom.winnerText = '';
    texasRoomSetMode('host');
    $('#texasRoomStatus').textContent = '建立中…';
    $('#texasRoomStatus').hidden = false;
    $('#texasQrGrid').hidden = true;
    const peer = new Peer(`${TEXAS_ROOM_HOST}${code.toLowerCase()}`, { debug: 1 });
    texasRoom.peer = peer;
    peer.on('open', () => {
      texasRoom.ready = true;
      $('#texasRoomStatus').textContent = `房間代號 ${code} · 等大家掃 QR 加入`;
      $('#texasRoomStatus').hidden = false;
      cardRoomBuildQr($('#texasQrGrid'), 'tx', code, texasRoom.players.map((p) => p.slot), '掃描後設定名字，等待開局');
      renderTexasRoomStage();
    });
    peer.on('connection', (conn) => cardRoomSetupHostConn(conn, handleTexasRoomHostMessage, (closed) => {
      const result = cardRoomRemoveConn(texasRoom.conns, closed);
      texasRoom.conns = result.conns;
      if (result.removed) {
        const player = texasRoom.players.find((x) => x.slot === result.removed.slot);
        if (player) player.online = false;
        const joined = texasRoom.players.filter((x) => x.joined).length;
        $('#texasRoomStatus').textContent = `房間代號 ${texasRoom.code} · 已加入 ${joined}/${texasRoom.players.length} 人`;
        texasRoomBroadcast();
      }
    }));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突，請重試'); resetTexasRoom(); }
      else showToast('連線暫時不穩，仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function joinTexasRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    texasRoom.mode = 'client';
    texasRoom.code = code;
    texasRoom.mySlot = slot;
    texasRoom.ready = false;
    texasRoom.conns = [];
    texasRoom.players = [];
    texasRoomSetMode('client');
    $('#texasRoomStatus').hidden = true;
    const peer = new Peer(makeCardClientId(TEXAS_ROOM_HOST, code, slot), { debug: 1 });
    texasRoom.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${TEXAS_ROOM_HOST}${code.toLowerCase()}`, { reliable: true });
      texasRoom.conn = conn;
      conn.on('open', () => {
        conn.send({ type: 'hello', slot, name: `玩家 ${slot}` });
      });
      conn.on('data', (message) => {
        try {
          if (message && message.type === 'state' && Array.isArray(message.players)) {
            texasRoom.players = message.players.map((p) => ({
              ...makeRoomPlayer(p.slot, 0),
              name: validString(p.name, `玩家 ${p.slot}`).trim().slice(0, 14) || `玩家 ${p.slot}`,
              chips: clamp(Math.floor(Number(p.chips) || 0), 0, 999999),
              bet: Math.max(0, Math.floor(Number(p.bet) || 0)),
              folded: Boolean(p.folded),
              allIn: Boolean(p.allIn),
              joined: Boolean(p.joined),
              online: p.online !== false,
              inHand: Boolean(p.inHand),
            }));
            texasRoom.handNo = Math.floor(Number(message.handNo) || 0);
            texasRoom.street = message.street || 'idle';
            texasRoom.community = Array.isArray(message.community) ? message.community : [];
            texasRoom.pot = Math.max(0, Math.floor(Number(message.pot) || 0));
            texasRoom.lastBet = Math.max(0, Math.floor(Number(message.lastBet) || 0));
            texasRoom.actor = message.actor ?? null;
            texasRoom.buttonSlot = message.buttonSlot ?? null;
            texasRoom.revealed = Boolean(message.revealed);
            texasRoom.seed = message.seed || '';
            texasRoom.winnerText = message.winnerText || '';
            texasRoom.handOver = message.stage === 'idle' || message.stage === 'showdown';
            texasRoom.log = Array.isArray(message.log) ? message.log : [];
            const me = texasRoom.players.find((p) => p.slot === texasRoom.mySlot);
            if (me) me.cards = Array.isArray(message.myCards) ? message.myCards : [];
            texasRoom.ready = true;
            renderTexasClient();
          }
        } catch (error) { /* ignore */ }
      });
      conn.on('close', () => renderTexasClient());
      conn.on('error', () => renderTexasClient());
    });
    peer.on('error', () => {
      texasRoom.ready = false;
      renderTexasClient();
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function resetTexasRoom() {
    try { if (texasRoom.peer) texasRoom.peer.destroy(); } catch (error) { /* ignore */ }
    texasRoom.mode = 'local';
    texasRoom.code = '';
    texasRoom.peer = null;
    texasRoom.conns = [];
    texasRoom.conn = null;
    texasRoom.mySlot = 0;
    texasRoom.ready = false;
    texasRoom.players = [];
    texasRoom.handNo = 0;
    texasRoom.street = 'idle';
    texasRoom.community = [];
    texasRoom.pot = 0;
    texasRoom.lastBet = 0;
    texasRoom.actor = null;
    texasRoom.buttonSlot = null;
    texasRoom.revealed = false;
    texasRoom.seed = '';
    texasRoom.log = [];
    texasRoom.winnerText = '';
    texasRoom.handOver = true;
    texasRoomSetMode('local');
    $('#texasRoom').hidden = true;
    $('#texasSolo').hidden = false;
  }

  $('#createTexasRoomButton').addEventListener('click', createTexasRoom);
  $('#endTexasRoomButton').addEventListener('click', () => {
    resetTexasRoom();
    showToast('已結束德州撲克房間');
  });

  // ---------- 21 點 · 多人 ----------
  const BJ_ROOM_HOST = 'pocket-bj-';
  const blackjackRoom = {
    mode: 'local', code: '', peer: null, conns: [], conn: null, mySlot: 0, ready: false,
    players: [], stage: 'lobby', turnSlot: null, dealerCards: [], roundNo: 0,
    shoe: buildShoe(6), log: [], resultText: '', dealt: false,
  };
  const bjOnlineWanted = initSoloToggle('bjPlayMode', (soloOn) => {
    if (!soloOn && blackjackRoom.mode === 'local') {
      $('#bjRoom').hidden = false;
      $('#bjSolo').hidden = true;
    } else if (soloOn && blackjackRoom.mode === 'local') {
      $('#bjRoom').hidden = true;
      $('#bjSolo').hidden = false;
    }
    if (blackjackRoom.mode === 'host' || blackjackRoom.mode === 'client') {
      $('#bjRoom').hidden = false;
      $('#bjSolo').hidden = true;
    }
  });

  function blackjackRoomSetMode(mode) {
    blackjackRoom.mode = mode;
    const connected = mode !== 'local';
    $('#bjRoom').hidden = !connected;
    $('#bjSolo').hidden = connected;
    $('#bjRoomBadge').textContent = mode === 'host' ? '莊家' : mode === 'client' ? '已連線' : '本機';
    $('#endBjRoomButton').hidden = !connected;
    if (!connected) {
      $('#bjRoomStatus').hidden = true;
      $('#bjQrGrid').hidden = true;
      $('#bjRoomIdle').hidden = true;
    } else {
      $('#bjRoomIdle').hidden = mode !== 'host';
    }
    if (mode === 'host') renderBlackjackRoomStage();
    if (mode === 'client') renderBlackjackClient();
    if (connected) {
      $$('#bjPlayMode .solo-mode-option').forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.playmode === 'online');
      });
    }
  }

  const bjRoomValue = (hand) => blackjackValue(hand);

  function bjRoomLogLine(text, kind = '') {
    blackjackRoom.log.push({ text, kind });
    if (blackjackRoom.log.length > 40) blackjackRoom.log.shift();
  }

  function bjRoomBroadcast() {
    const base = {
      type: 'state',
      stage: blackjackRoom.stage,
      roundNo: blackjackRoom.roundNo,
      turnSlot: blackjackRoom.turnSlot,
      dealerCards: blackjackRoom.dealerCards,
      dealt: blackjackRoom.dealt,
      resultText: blackjackRoom.resultText,
      log: blackjackRoom.log.slice(-10),
      players: blackjackRoom.players.map((p) => ({
        slot: p.slot, name: p.name, chips: p.chips, bet: p.bet, locked: p.locked,
        joined: p.joined, online: p.online !== false, doubled: p.doubled,
        finished: p.finished, result: p.result,
      })),
    };
    blackjackRoom.conns.forEach((entry) => {
      const me = blackjackRoom.players.find((p) => p.slot === entry.slot);
      cardRoomSend(entry.conn, { ...base, myCards: me ? me.cards : [] });
    });
    renderBlackjackRoomStage();
  }

  function blackjackRoomStartBetting() {
    blackjackRoom.stage = 'bet';
    blackjackRoom.dealt = false;
    blackjackRoom.dealerCards = [];
    blackjackRoom.turnSlot = null;
    blackjackRoom.resultText = '';
    blackjackRoom.players.forEach((p) => {
      p.bet = p.bet > 0 ? p.bet : 0;
      p.locked = false;
      p.cards = [];
      p.doubled = false;
      p.finished = false;
      p.result = '';
    });
    bjRoomLogLine(`第 ${blackjackRoom.roundNo + 1} 局：大家下注`, '');
    bjRoomBroadcast();
  }

  function blackjackRoomDeal() {
    const joined = blackjackRoom.players.filter((p) => p.joined);
    if (joined.some((p) => !p.locked)) {
      showToast('還有牌手未鎖定下注');
      return;
    }
    blackjackRoom.roundNo += 1;
    blackjackRoom.stage = 'play';
    blackjackRoom.dealt = true;
    blackjackRoom.dealerCards = [];
    blackjackRoom.turnSlot = null;
    blackjackRoom.resultText = '';
    if (blackjackRoom.shoe.deck.length < 52) {
      blackjackRoom.shoe = buildShoe(6);
      bjRoomLogLine('牌不夠，已重洗 6 副牌鞋', '');
    }
    blackjackRoom.players.forEach((p) => {
      if (!p.joined) return;
      p.cards = [blackjackRoom.shoe.deck.pop(), blackjackRoom.shoe.deck.pop()];
      p.chips -= p.bet;
      p.finished = bjRoomValue(p.cards) === 21;
      p.result = '';
    });
    blackjackRoom.dealerCards = [blackjackRoom.shoe.deck.pop(), blackjackRoom.shoe.deck.pop()];
    bjRoomLogLine(`第 ${blackjackRoom.roundNo} 局發牌`, '');
    blackjackRoomAdvanceTurn();
  }

  function blackjackRoomAdvanceTurn() {
    const order = blackjackRoom.players.filter((p) => p.joined).map((p) => p.slot);
    const idx = order.indexOf(blackjackRoom.turnSlot);
    for (let step = 0; step < order.length; step += 1) {
      const slot = order[(idx + 1) % order.length];
      const p = blackjackRoom.players.find((x) => x.slot === slot);
      if (p && !p.finished) {
        blackjackRoom.turnSlot = slot;
        bjRoomBroadcast();
        return;
      }
    }
    blackjackRoomDealerPlay();
  }

  function blackjackRoomApply(slot, action) {
    if (blackjackRoom.stage !== 'play' || blackjackRoom.turnSlot !== slot) return;
    const p = blackjackRoom.players.find((x) => x.slot === slot);
    if (!p || p.finished) return;
    if (action === 'stand') {
      p.finished = true;
      bjRoomLogLine(`${p.name} 停牌（${bjRoomValue(p.cards)}）`, '');
    } else if (action === 'hit') {
      p.cards.push(blackjackRoom.shoe.deck.pop());
      if (bjRoomValue(p.cards) > 21) {
        p.finished = true;
        p.result = 'bust';
        bjRoomLogLine(`${p.name} 爆牌（${bjRoomValue(p.cards)}）`, 'loss');
      }
    } else if (action === 'double') {
      if (p.cards.length !== 2 || p.doubled || p.chips < p.bet) return;
      p.chips -= p.bet;
      p.bet *= 2;
      p.doubled = true;
      p.cards.push(blackjackRoom.shoe.deck.pop());
      p.finished = true;
      if (bjRoomValue(p.cards) > 21) p.result = 'bust';
      bjRoomLogLine(`${p.name} 加倍 ${p.bet}`, '');
    }
    blackjackRoomAdvanceTurn();
  }

  function blackjackRoomDealerPlay() {
    blackjackRoom.stage = 'deal';
    blackjackRoom.dealerCards = [blackjackRoom.shoe.deck.pop(), blackjackRoom.shoe.deck.pop()];
    const playerBJ = blackjackRoom.players.some((p) => p.joined && bjRoomValue(p.cards) === 21 && p.cards.length === 2);
    if (!playerBJ) {
      while (bjRoomValue(blackjackRoom.dealerCards) < 17) {
        blackjackRoom.dealerCards.push(blackjackRoom.shoe.deck.pop());
      }
    }
    blackjackRoomSettle();
  }

  function blackjackRoomSettle() {
    const dealer = bjRoomValue(blackjackRoom.dealerCards);
    const dealerBJ = dealer === 21 && blackjackRoom.dealerCards.length === 2;
    blackjackRoom.players.forEach((p) => {
      if (!p.joined) return;
      const value = bjRoomValue(p.cards);
      const playerBJ = value === 21 && p.cards.length === 2;
      if (value > 21 || p.result === 'bust') {
        p.result = 'loss';
      } else if (dealer > 21) {
        p.chips += p.bet * 2;
        p.result = 'win';
      } else if (playerBJ && !dealerBJ) {
        const win = Math.floor(p.bet * 2.5);
        p.chips += win;
        p.result = 'win';
      } else if (dealerBJ && !playerBJ) {
        p.result = 'loss';
      } else if (value > dealer) {
        p.chips += p.bet * 2;
        p.result = 'win';
      } else if (dealer > value) {
        p.result = 'loss';
      } else {
        p.chips += p.bet;
        p.result = 'push';
      }
      p.lastResult = p.result;
      p.finished = true;
    });
    blackjackRoom.stage = 'over';
    blackjackRoom.turnSlot = null;
    blackjackRoom.resultText = `莊家 ${dealer} 點 · ${dealer > 21 ? '爆牌' : dealerBJ ? '黑傑克' : '結算'}`;
    const wins = blackjackRoom.players.filter((p) => p.joined && p.result === 'win').length;
    bjRoomLogLine(`莊家 ${dealer} 點，${wins} 人贏`, '');
    bjRoomBroadcast();
  }

  function renderBlackjackRoomStage() {
    const stage = $('#bjRoomStage');
    stage.replaceChildren();
    const header = document.createElement('div');
    header.className = 'room-row-head';
    const title = document.createElement('strong');
    title.textContent = blackjackRoom.roundNo > 0
      ? `第 ${blackjackRoom.roundNo} 局`
      : (blackjackRoom.stage === 'bet' ? '押注中 · 準備第 1 局' : '等待開局');
    const info = document.createElement('span');
    info.textContent = `莊家 ${blackjackRoom.dealerCards.length ? `${bjRoomValue(blackjackRoom.dealerCards)} 點` : '未發牌'} · 牌鞋 ${blackjackRoom.shoe.deck.length} 張`;
    header.append(title, info);
    stage.appendChild(header);

    const dealerRow = document.createElement('div');
    dealerRow.className = 'card-room-table';
    const dHead = document.createElement('div');
    dHead.className = 'room-row-head';
    const dName = document.createElement('strong');
    dName.textContent = '🤖 莊家';
    const dStatus = document.createElement('span');
    dStatus.textContent = blackjackRoom.dealt ? '暗牌一張' : '等待下注';
    dHead.append(dName, dStatus);
    const dCards = document.createElement('div');
    dCards.className = 'room-cards';
    blackjackRoom.dealerCards.forEach((card, index) => {
      dCards.appendChild(createCardEl(card, { down: index > 0 && blackjackRoom.stage !== 'over' && blackjackRoom.stage !== 'deal' }));
    });
    dealerRow.append(dHead, dCards);
    stage.appendChild(dealerRow);

    const table = document.createElement('div');
    table.className = 'card-room-table';
    blackjackRoom.players.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'room-row-head';
      const name = document.createElement('strong');
      name.textContent = `${p.joined ? p.name : `（未加入）玩家 ${p.slot}`}${p.slot === blackjackRoom.turnSlot ? ' ▶' : ''}`;
      const status = document.createElement('span');
      status.textContent = !p.joined ? '等待加入' : blackjackRoom.stage === 'bet' ? (p.locked ? `已鎖定 ${p.bet}` : '下注中') : blackjackRoom.stage === 'over' ? (p.result === 'win' ? '🎉 贏' : p.result === 'loss' ? '輸' : p.result === 'push' ? '和局' : '—') : p.finished ? `${bjRoomValue(p.cards)} 點` : `${bjRoomValue(p.cards)} 點`;
      row.append(name, status);
      const cards = document.createElement('div');
      cards.className = 'room-cards';
      (p.cards || []).forEach((card) => cards.appendChild(createCardEl(card)));
      row.appendChild(cards);
      table.appendChild(row);
    });
    stage.appendChild(table);

    const note = document.createElement('p');
    note.className = 'room-note';
    note.textContent = blackjackRoom.resultText || (blackjackRoom.stage === 'bet' ? '等所有牌手下注並鎖定，莊家才發牌。' : blackjackRoom.stage === 'play' ? '按座位順序輪流行動。' : '牌手每人 1000 枚籌碼，黑傑克 3:2。');
    stage.appendChild(note);

    const logEl = document.createElement('div');
    logEl.className = 'round-log';
    blackjackRoom.log.slice(-8).forEach((entry) => {
      const line = document.createElement('div');
      line.className = `log-line is-${entry.kind}`;
      line.textContent = entry.text;
      logEl.appendChild(line);
    });
    stage.appendChild(logEl);

    const actions = document.createElement('div');
    actions.className = 'client-actions';
    if (blackjackRoom.stage === 'lobby') {
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'action-btn is-primary';
      start.textContent = '開始下注 · 第 1 局';
      start.addEventListener('click', blackjackRoomStartBetting);
      actions.appendChild(start);
    } else if (blackjackRoom.stage === 'bet') {
      const deal = document.createElement('button');
      deal.type = 'button';
      deal.className = 'action-btn is-primary';
      deal.textContent = '發牌 · 開始第 ' + (blackjackRoom.roundNo + 1) + ' 局';
      deal.addEventListener('click', blackjackRoomDeal);
      actions.appendChild(deal);
    } else if (blackjackRoom.stage === 'over') {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'action-btn is-primary';
      next.textContent = '再開一局 · 重新下注';
      next.addEventListener('click', blackjackRoomStartBetting);
      actions.appendChild(next);
    }
    stage.appendChild(actions);
  }

  function renderBlackjackClient() {
    const stage = $('#bjRoomStage');
    stage.replaceChildren();
    const me = blackjackRoom.players.find((p) => p.slot === blackjackRoom.mySlot);
    if (!blackjackRoom.ready || !me) {
      const wait = document.createElement('div');
      wait.className = 'room-waiting';
      wait.innerHTML = '<strong>正在連線莊家…</strong><span>若一直停在這，請確認莊家手機已建立房間且網路正常。</span>';
      stage.appendChild(wait);
      return;
    }
    const head = document.createElement('div');
    head.className = 'room-row-head';
    const title = document.createElement('strong');
    title.textContent = `21 點 · 第 ${blackjackRoom.roundNo || '—'} 局`;
    const info = document.createElement('span');
    info.textContent = `你 ${formatBankroll(me.chips)} 枚`;
    head.append(title, info);
    stage.appendChild(head);

    const dealerCards = document.createElement('div');
    dealerCards.className = 'hand-cards';
    const dealerVisible = blackjackRoom.stage === 'over' || blackjackRoom.stage === 'deal';
    blackjackRoom.dealerCards.forEach((card, index) => {
      dealerCards.appendChild(createCardEl(card, { down: index > 0 && !dealerVisible }));
    });
    const dealerNote = document.createElement('p');
    dealerNote.className = 'room-note';
    dealerNote.textContent = `莊家 ${dealerVisible ? bjRoomValue(blackjackRoom.dealerCards) : blackjackRoom.dealerCards[0] ? cardRankLabel(blackjackRoom.dealerCards[0].rank) + ' + ?' : '—'} 點`;
    stage.append(dealerCards, dealerNote);

    const myCards = document.createElement('div');
    myCards.className = 'hand-cards';
    (me.cards || []).forEach((card) => myCards.appendChild(createCardEl(card)));
    const myNote = document.createElement('p');
    myNote.className = 'room-note';
    myNote.textContent = `你 ${me.cards.length ? bjRoomValue(me.cards) : '—'} 點 · 本局下注 ${me.bet} 枚`;
    stage.append(myCards, myNote);

    if (blackjackRoom.stage === 'bet') {
      const betRow = document.createElement('div');
      betRow.className = 'client-bet-row';
      [100, 250, 500, 1000].forEach((amount) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bet-chip';
        chip.textContent = String(amount);
        chip.classList.toggle('is-selected', me.bet === amount);
        chip.addEventListener('click', () => cardRoomSend(blackjackRoom.conn, { type: 'bet', amount }));
        betRow.appendChild(chip);
      });
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'bet-chip';
      all.textContent = '全下';
      all.classList.toggle('is-selected', me.bet === me.chips);
      all.addEventListener('click', () => cardRoomSend(blackjackRoom.conn, { type: 'bet', amount: 'all' }));
      betRow.appendChild(all);
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'action-btn is-primary';
      lock.textContent = me.locked ? `已鎖定 ${me.bet} 枚 ✓（再按可改）` : `鎖定下注 ${me.bet}`;
      lock.addEventListener('click', () => cardRoomSend(blackjackRoom.conn, { type: 'lock' }));
      stage.append(betRow, lock);
    } else if (blackjackRoom.stage === 'play' && blackjackRoom.turnSlot !== me.slot && !me.finished) {
      const others = blackjackRoom.players.find((p) => p.slot === blackjackRoom.turnSlot);
      const wait = document.createElement('p');
      wait.className = 'room-note';
      wait.textContent = others && others.joined ? `等 ${others.name} 行動…` : '等莊家發牌…';
      stage.appendChild(wait);
    } else if (blackjackRoom.stage === 'play' && blackjackRoom.turnSlot === me.slot && !me.finished) {
      const actions = document.createElement('div');
      actions.className = 'client-actions';
      const hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'action-btn is-primary';
      hit.textContent = '要牌';
      hit.addEventListener('click', () => cardRoomSend(blackjackRoom.conn, { type: 'bjact', action: 'hit' }));
      const stand = document.createElement('button');
      stand.type = 'button';
      stand.className = 'action-btn';
      stand.textContent = '停牌';
      stand.addEventListener('click', () => cardRoomSend(blackjackRoom.conn, { type: 'bjact', action: 'stand' }));
      actions.append(hit, stand);
      if (me.cards.length === 2 && !me.doubled && me.chips >= me.bet) {
        const double = document.createElement('button');
        double.type = 'button';
        double.className = 'action-btn';
        double.textContent = '加倍 ×2';
        double.addEventListener('click', () => cardRoomSend(blackjackRoom.conn, { type: 'bjact', action: 'double' }));
        actions.appendChild(double);
      }
      stage.appendChild(actions);
    } else if (blackjackRoom.stage === 'over') {
      const result = document.createElement('div');
      result.className = `client-result ${me.result === 'win' ? '' : me.result === 'loss' ? 'is-loss' : 'is-push'}`;
      result.textContent = me.result === 'win' ? '🎉 你贏了！' : me.result === 'loss' ? '你輸了' : '和局，下注退回';
      stage.appendChild(result);
    }
  }

  function handleBlackjackRoomHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    const p = blackjackRoom.players.find((x) => x.slot === conn.slot);
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 1, blackjackRoom.players.length);
      conn.slot = slot;
      const player = blackjackRoom.players.find((x) => x.slot === slot);
      const name = validString(message.name, '').trim().slice(0, 14);
      if (player) {
        player.joined = true;
        player.online = true;
        if (name) player.name = name;
      }
      if (!blackjackRoom.conns.some((entry) => entry.conn === conn)) blackjackRoom.conns.push({ conn, slot });
      const joined = blackjackRoom.players.filter((x) => x.joined).length;
      $('#bjRoomStatus').textContent = `房間代號 ${blackjackRoom.code} · 已加入 ${joined}/${blackjackRoom.players.length} 人`;
      $('#bjRoomStatus').hidden = false;
      bjRoomBroadcast();
    } else if (message.type === 'bet' && p) {
      if (blackjackRoom.stage !== 'bet') return;
      const chips = p.chips;
      p.bet = message.amount === 'all' ? chips : Math.min(Math.floor(Number(message.amount) || 0), chips);
      p.locked = false;
      bjRoomBroadcast();
    } else if (message.type === 'lock' && p) {
      if (blackjackRoom.stage !== 'bet') return;
      if (p.bet <= 0) {
        showToast(`${p.name} 還未選下注金額`);
        return;
      }
      p.locked = true;
      bjRoomBroadcast();
    } else if (message.type === 'bjact') {
      blackjackRoomApply(conn.slot, message.action);
    }
  }

  function createBlackjackRoom() {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    const count = clamp(Math.floor(Number($('#bjRoomPlayers').value) || 4), 2, 8);
    const code = makeRoomCode();
    blackjackRoom.code = code;
    blackjackRoom.mySlot = 0;
    blackjackRoom.conns = [];
    blackjackRoom.players = Array.from({ length: count }, (_, index) => makeRoomPlayer(index + 1, index));
    blackjackRoom.roundNo = 0;
    blackjackRoom.stage = 'lobby';
    blackjackRoom.dealt = false;
    blackjackRoom.dealerCards = [];
    blackjackRoom.turnSlot = null;
    blackjackRoom.resultText = '';
    blackjackRoom.log = [];
    blackjackRoomSetMode('host');
    $('#bjRoomStatus').textContent = '建立中…';
    $('#bjRoomStatus').hidden = false;
    $('#bjQrGrid').hidden = true;
    const peer = new Peer(`${BJ_ROOM_HOST}${code.toLowerCase()}`, { debug: 1 });
    blackjackRoom.peer = peer;
    peer.on('open', () => {
      blackjackRoom.ready = true;
      $('#bjRoomStatus').textContent = `房間代號 ${code} · 等大家掃 QR 加入`;
      $('#bjRoomStatus').hidden = false;
      cardRoomBuildQr($('#bjQrGrid'), 'bj', code, blackjackRoom.players.map((p) => p.slot), '掃描後設定名字，等待下注');
      renderBlackjackRoomStage();
    });
    peer.on('connection', (conn) => cardRoomSetupHostConn(conn, handleBlackjackRoomHostMessage, (closed) => {
      const result = cardRoomRemoveConn(blackjackRoom.conns, closed);
      blackjackRoom.conns = result.conns;
      if (result.removed) {
        const player = blackjackRoom.players.find((x) => x.slot === result.removed.slot);
        if (player) player.online = false;
        const joined = blackjackRoom.players.filter((x) => x.joined).length;
        $('#bjRoomStatus').textContent = `房間代號 ${blackjackRoom.code} · 已加入 ${joined}/${blackjackRoom.players.length} 人`;
        bjRoomBroadcast();
      }
    }));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突，請重試'); resetBlackjackRoom(); }
      else showToast('連線暫時不穩，仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function joinBlackjackRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    blackjackRoom.mode = 'client';
    blackjackRoom.code = code;
    blackjackRoom.mySlot = slot;
    blackjackRoom.ready = false;
    blackjackRoom.conns = [];
    blackjackRoom.players = [];
    blackjackRoomSetMode('client');
    $('#bjRoomStatus').hidden = true;
    const peer = new Peer(makeCardClientId(BJ_ROOM_HOST, code, slot), { debug: 1 });
    blackjackRoom.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${BJ_ROOM_HOST}${code.toLowerCase()}`, { reliable: true });
      blackjackRoom.conn = conn;
      conn.on('open', () => conn.send({ type: 'hello', slot, name: `玩家 ${slot}` }));
      conn.on('data', (message) => {
        try {
          if (message && message.type === 'state' && Array.isArray(message.players)) {
            blackjackRoom.players = message.players.map((p) => ({
              ...makeRoomPlayer(p.slot, 0),
              name: validString(p.name, `玩家 ${p.slot}`).trim().slice(0, 14) || `玩家 ${p.slot}`,
              chips: clamp(Math.floor(Number(p.chips) || 0), 0, 999999),
              bet: Math.max(0, Math.floor(Number(p.bet) || 0)),
              locked: Boolean(p.locked),
              joined: Boolean(p.joined),
              online: p.online !== false,
              doubled: Boolean(p.doubled),
              finished: Boolean(p.finished),
              result: p.result || '',
            }));
            blackjackRoom.stage = message.stage || 'lobby';
            blackjackRoom.roundNo = Math.floor(Number(message.roundNo) || 0);
            blackjackRoom.turnSlot = message.turnSlot ?? null;
            blackjackRoom.dealerCards = Array.isArray(message.dealerCards) ? message.dealerCards : [];
            blackjackRoom.dealt = Boolean(message.dealt);
            blackjackRoom.resultText = message.resultText || '';
            blackjackRoom.log = Array.isArray(message.log) ? message.log : [];
            const me = blackjackRoom.players.find((p) => p.slot === blackjackRoom.mySlot);
            if (me) me.cards = Array.isArray(message.myCards) ? message.myCards : [];
            blackjackRoom.ready = true;
            renderBlackjackClient();
          }
        } catch (error) { /* ignore */ }
      });
      conn.on('close', () => renderBlackjackClient());
      conn.on('error', () => renderBlackjackClient());
    });
    peer.on('error', () => {
      blackjackRoom.ready = false;
      renderBlackjackClient();
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function resetBlackjackRoom() {
    try { if (blackjackRoom.peer) blackjackRoom.peer.destroy(); } catch (error) { /* ignore */ }
    blackjackRoom.mode = 'local';
    blackjackRoom.code = '';
    blackjackRoom.peer = null;
    blackjackRoom.conns = [];
    blackjackRoom.conn = null;
    blackjackRoom.mySlot = 0;
    blackjackRoom.ready = false;
    blackjackRoom.players = [];
    blackjackRoom.stage = 'lobby';
    blackjackRoom.turnSlot = null;
    blackjackRoom.dealerCards = [];
    blackjackRoom.roundNo = 0;
    blackjackRoom.resultText = '';
    blackjackRoom.log = [];
    blackjackRoom.dealt = false;
    blackjackRoomSetMode('local');
    $('#bjRoom').hidden = true;
    $('#bjSolo').hidden = false;
  }

  $('#createBjRoomButton').addEventListener('click', createBlackjackRoom);
  $('#endBjRoomButton').addEventListener('click', () => {
    resetBlackjackRoom();
    showToast('已結束 21 點房間');
  });

  // ---------- 百家樂 · 多人 ----------
  const BAC_ROOM_HOST = 'pocket-bac-';
  const baccaratRoom = {
    mode: 'local', code: '', peer: null, conns: [], conn: null, mySlot: 0, ready: false,
    players: [], stage: 'lobby', playerCards: [], bankerCards: [], roundNo: 0,
    shoe: buildShoe(8), note: '', route: [], resultText: '',
  };
  const bacOnlineWanted = initSoloToggle('bacPlayMode', (soloOn) => {
    if (!soloOn && baccaratRoom.mode === 'local') {
      $('#bacRoom').hidden = false;
      $('#bacSolo').hidden = true;
    } else if (soloOn && baccaratRoom.mode === 'local') {
      $('#bacRoom').hidden = true;
      $('#bacSolo').hidden = false;
    }
    if (baccaratRoom.mode === 'host' || baccaratRoom.mode === 'client') {
      $('#bacRoom').hidden = false;
      $('#bacSolo').hidden = true;
    }
  });

  function baccaratRoomSetMode(mode) {
    baccaratRoom.mode = mode;
    const connected = mode !== 'local';
    $('#bacRoom').hidden = !connected;
    $('#bacSolo').hidden = connected;
    $('#bacRoomBadge').textContent = mode === 'host' ? '莊家' : mode === 'client' ? '已連線' : '本機';
    $('#endBacRoomButton').hidden = !connected;
    if (!connected) {
      $('#bacRoomStatus').hidden = true;
      $('#bacQrGrid').hidden = true;
      $('#bacRoomIdle').hidden = true;
    } else {
      $('#bacRoomIdle').hidden = mode !== 'host';
    }
    if (mode === 'host') renderBaccaratRoomStage();
    if (mode === 'client') renderBaccaratClient();
    if (connected) {
      $$('#bacPlayMode .solo-mode-option').forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.playmode === 'online');
      });
    }
  }

  function baccaratRoomLogLine(text, kind = '') {
    baccaratRouteLog(text, kind);
  }

  function baccaratRouteLog(text, kind = '') {
    baccaratRoom.note = text;
  }

  function bacRoomBroadcast() {
    const base = {
      type: 'state',
      stage: baccaratRoom.stage,
      roundNo: baccaratRoom.roundNo,
      playerCards: baccaratRoom.playerCards,
      bankerCards: baccaratRoom.bankerCards,
      note: baccaratRoom.note,
      resultText: baccaratRoom.resultText,
      route: baccaratRoom.route.slice(-12),
      players: baccaratRoom.players.map((p) => ({
        slot: p.slot, name: p.name, chips: p.chips, bet: p.bet, side: p.side,
        locked: p.locked, joined: p.joined, online: p.online !== false, lastResult: p.lastResult,
      })),
    };
    cardRoomBroadcast(baccaratRoom.conns, base);
    renderBaccaratRoomStage();
  }

  function baccaratRoomStartBetting() {
    baccaratRoom.stage = 'bet';
    baccaratRoom.playerCards = [];
    baccaratRoom.bankerCards = [];
    baccaratRoom.note = '';
    baccaratRoom.resultText = '';
    baccaratRoom.players.forEach((p) => {
      p.locked = false;
      if (p.bet <= 0) p.bet = 100;
      p.lastResult = '';
    });
    baccaratRoomLogLine(`第 ${baccaratRoom.roundNo + 1} 局：大家押注`, '');
    bacRoomBroadcast();
  }

  function baccaratRoomPlay() {
    const locked = baccaratRoom.players.filter((p) => p.joined && p.locked);
    if (!locked.length) {
      showToast('至少一位牌手鎖定下注才能開牌');
      return;
    }
    baccaratRoom.roundNo += 1;
    baccaratRoom.stage = 'over';
    baccaratRoom.playerCards = [];
    baccaratRoom.bankerCards = [];
    baccaratRoom.note = '';
    if (baccaratRoom.shoe.deck.length < 40) {
      baccaratRoom.shoe = buildShoe(8);
      baccaratRoom.note = '牌剩不多，已重洗 8 副牌鞋';
    }
    const draw = () => baccaratRoom.shoe.deck.pop();
    baccaratRoom.playerCards = [draw(), draw()];
    baccaratRoom.bankerCards = [draw(), draw()];
    let playerTotal = bacValue(baccaratRoom.playerCards);
    let bankerTotal = bacValue(baccaratRoom.bankerCards);
    if (playerTotal >= 8 || bankerTotal >= 8) {
      baccaratRoom.note = `天生 ${Math.max(playerTotal, bankerTotal)} 點，兩邊不補牌`;
    } else {
      let third = null;
      if (playerTotal <= 5) {
        const card = draw();
        baccaratRoom.playerCards.push(card);
        third = bacCardPoint(card.rank);
        baccaratRoom.note = `閒家補第三張（${third} 點）`;
      } else {
        baccaratRoom.note = '閒家 6/7 點，停牌';
      }
      let drawBanker = false;
      if (third === null) drawBanker = bankerTotal <= 5;
      else if (bankerTotal <= 2) drawBanker = true;
      else if (bankerTotal === 3) drawBanker = third !== 8;
      else if (bankerTotal === 4) drawBanker = ![0, 1, 8, 9].includes(third);
      else if (bankerTotal === 5) drawBanker = ![0, 1, 2, 3, 8, 9].includes(third);
      else if (bankerTotal === 6) drawBanker = third === 6 || third === 7;
      if (drawBanker) {
        baccaratRoom.bankerCards.push(draw());
        baccaratRoom.note += '；莊家補第三張';
      } else {
        baccaratRoom.note += '；莊家不補';
      }
    }
    const player = bacValue(baccaratRoom.playerCards);
    const banker = bacValue(baccaratRoom.bankerCards);
    const side = player === banker ? 'tie' : player > banker ? 'player' : 'banker';
    baccaratRoom.route.push(side);
    if (baccaratRoom.route.length > 12) baccaratRoom.route.shift();
    baccaratRoom.players.forEach((p) => {
      if (!p.joined || !p.locked || p.bet <= 0) return;
      p.chips -= p.bet;
      if (side === 'tie') {
        if (p.side === 'tie') {
          p.chips += p.bet * 9;
          p.lastResult = 'win';
        } else {
          p.chips += p.bet;
          p.lastResult = 'push';
        }
      } else if (side === p.side) {
        if (side === 'player') {
          p.chips += p.bet * 2;
          p.lastResult = 'win';
        } else {
          p.chips += p.bet + Math.floor(p.bet * 0.95);
          p.lastResult = 'win';
        }
      } else {
        p.lastResult = 'loss';
      }
    });
    baccaratRoom.resultText = `${side === 'player' ? '閒' : side === 'banker' ? '莊' : '和'} 贏 ${player}:${banker}`;
    baccaratRoomLogLine(baccaratRoom.resultText, side === 'tie' ? 'push' : '');
    bacRoomBroadcast();
  }

  function renderBaccaratRoomStage() {
    const stage = $('#bacRoomStage');
    stage.replaceChildren();
    const header = document.createElement('div');
    header.className = 'room-row-head';
    const title = document.createElement('strong');
    title.textContent = `百家樂 · ${baccaratRoom.roundNo > 0
      ? `第 ${baccaratRoom.roundNo} 局`
      : (baccaratRoom.stage === 'bet' ? '押注中 · 準備第 1 局' : '等待開局')}`;
    const info = document.createElement('span');
    info.textContent = `牌鞋 ${baccaratRoom.shoe.deck.length} 張`;
    header.append(title, info);
    stage.appendChild(header);

    const row = document.createElement('div');
    row.className = 'baccarat-row';
    [[baccaratRoom.playerCards, '👤 閒家 PLAYER', 'bac-name-player', 'pacPlayerTotal'], [baccaratRoom.bankerCards, '🏦 莊家 BANKER', 'bac-name-banker', '']].forEach(([cards, label, nameCls]) => {
      const seat = document.createElement('div');
      seat.className = 'seat-baccarat';
      const head = document.createElement('div');
      head.className = 'seat-head';
      const nm = document.createElement('span');
      nm.className = `seat-name ${nameCls}`;
      nm.textContent = label;
      const total = document.createElement('span');
      total.className = 'seat-chips';
      total.textContent = cards.length ? `${bacValue(cards)} 點` : '—';
      head.append(nm, total);
      const hand = document.createElement('div');
      hand.className = 'hand-cards';
      cards.forEach((card) => hand.appendChild(createCardEl(card)));
      seat.append(head, hand);
      row.appendChild(seat);
    });
    const vs = document.createElement('div');
    vs.className = 'baccarat-vs';
    vs.textContent = 'VS';
    row.insertBefore(vs, row.children[1]);
    stage.appendChild(row);

    const route = document.createElement('div');
    route.className = 'bac-route';
    baccaratRoom.route.forEach((side) => {
      const chip = document.createElement('span');
      chip.className = `route-chip route-${side}`;
      chip.textContent = side === 'player' ? '閒' : side === 'banker' ? '莊' : '和';
      route.appendChild(chip);
    });
    stage.appendChild(route);

    const note = document.createElement('p');
    note.className = 'room-note';
    note.textContent = baccaratRoom.note || baccaratRoom.resultText || (baccaratRoom.stage === 'bet' ? '等牌手押注並鎖定。' : '牌手每人 1000 枚籌碼。');
    stage.appendChild(note);

    const table = document.createElement('div');
    table.className = 'card-room-table';
    baccaratRoom.players.forEach((p) => {
      const rowHead = document.createElement('div');
      rowHead.className = 'room-row-head';
      const name = document.createElement('strong');
      name.textContent = p.joined ? p.name : `（未加入）玩家 ${p.slot}`;
      const status = document.createElement('span');
      status.textContent = !p.joined ? '等待加入' : baccaratRoom.stage === 'bet' ? (p.locked ? `${p.bet} → ${p.side === 'player' ? '閒' : p.side === 'banker' ? '莊' : '和'}` : '下注中') : p.lastResult === 'win' ? '🎉 贏' : p.lastResult === 'loss' ? '輸' : p.lastResult === 'push' ? '退回' : `${p.bet} → ${p.side === 'player' ? '閒' : p.side === 'banker' ? '莊' : '和'}`;
      rowHead.append(name, status);
      table.appendChild(rowHead);
    });
    stage.appendChild(table);

    const actions = document.createElement('div');
    actions.className = 'client-actions';
    if (baccaratRoom.stage === 'lobby') {
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'action-btn is-primary';
      start.textContent = '開始押注 · 第 1 局';
      start.addEventListener('click', baccaratRoomStartBetting);
      actions.appendChild(start);
    } else if (baccaratRoom.stage === 'bet') {
      const deal = document.createElement('button');
      deal.type = 'button';
      deal.className = 'action-btn is-primary';
      deal.textContent = '開牌 · 第 ' + (baccaratRoom.roundNo + 1) + ' 局';
      deal.addEventListener('click', baccaratRoomPlay);
      actions.appendChild(deal);
    } else if (baccaratRoom.stage === 'over') {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'action-btn is-primary';
      next.textContent = '再開一局 · 重新押注';
      next.addEventListener('click', baccaratRoomStartBetting);
      actions.appendChild(next);
    }
    stage.appendChild(actions);
  }

  function renderBaccaratClient() {
    const stage = $('#bacRoomStage');
    stage.replaceChildren();
    const me = baccaratRoom.players.find((p) => p.slot === baccaratRoom.mySlot);
    if (!baccaratRoom.ready || !me) {
      const wait = document.createElement('div');
      wait.className = 'room-waiting';
      wait.innerHTML = '<strong>正在連線莊家…</strong><span>若一直停在這，請確認莊家手機已建立房間且網路正常。</span>';
      stage.appendChild(wait);
      return;
    }
    const head = document.createElement('div');
    head.className = 'room-row-head';
    const title = document.createElement('strong');
    title.textContent = `百家樂 · 第 ${baccaratRoom.roundNo || '—'} 局`;
    const info = document.createElement('span');
    info.textContent = `你 ${formatBankroll(me.chips)} 枚`;
    head.append(title, info);
    stage.appendChild(head);

    if (baccaratRoom.stage === 'bet') {
      const sideLabel = document.createElement('p');
      sideLabel.className = 'room-note';
      sideLabel.textContent = '押哪一邊？';
      stage.appendChild(sideLabel);
      const sides = document.createElement('div');
      sides.className = 'bac-side-row';
      [['player', '閒', '1:1'], ['banker', '莊', '1:0.95'], ['tie', '和', '8:1']].forEach(([key, label, odds]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bac-side';
        button.classList.toggle('is-selected', me.side === key);
        button.innerHTML = `${label} <span>${odds}</span>`;
        button.addEventListener('click', () => cardRoomSend(baccaratRoom.conn, { type: 'side', side: key }));
        sides.appendChild(button);
      });
      stage.appendChild(sides);
      const betRow = document.createElement('div');
      betRow.className = 'client-bet-row';
      [100, 250, 500, 1000].forEach((amount) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bet-chip';
        chip.textContent = String(amount);
        chip.classList.toggle('is-selected', me.bet === amount);
        chip.addEventListener('click', () => cardRoomSend(baccaratRoom.conn, { type: 'bet', amount }));
        betRow.appendChild(chip);
      });
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'bet-chip';
      all.textContent = '全下';
      all.classList.toggle('is-selected', me.bet === me.chips);
      all.addEventListener('click', () => cardRoomSend(baccaratRoom.conn, { type: 'bet', amount: 'all' }));
      betRow.appendChild(all);
      stage.appendChild(betRow);
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'action-btn is-primary';
      lock.textContent = me.locked ? `已鎖定 ${me.bet} → ${me.side === 'player' ? '閒' : me.side === 'banker' ? '莊' : '和'} ✓` : `鎖定下注 ${me.bet}`;
      lock.addEventListener('click', () => cardRoomSend(baccaratRoom.conn, { type: 'lock' }));
      stage.appendChild(lock);
    } else if (baccaratRoom.stage === 'over') {
      const cards = document.createElement('div');
      cards.className = 'baccarat-row';
      [[baccaratRoom.playerCards, '👤 閒家', 'bac-name-player'], [baccaratRoom.bankerCards, '🏦 莊家', 'bac-name-banker']].forEach(([hand, label, nameCls]) => {
        const seat = document.createElement('div');
        seat.className = 'seat-baccarat';
        const head = document.createElement('div');
        head.className = 'seat-head';
        const nm = document.createElement('span');
        nm.className = `seat-name ${nameCls}`;
        nm.textContent = label;
        const total = document.createElement('span');
        total.className = 'seat-chips';
        total.textContent = `${bacValue(hand)} 點`;
        head.append(nm, total);
        const cardsRow = document.createElement('div');
        cardsRow.className = 'hand-cards';
        hand.forEach((card) => cardsRow.appendChild(createCardEl(card)));
        seat.append(head, cardsRow);
        cards.appendChild(seat);
      });
      const vs = document.createElement('div');
      vs.className = 'baccarat-vs';
      vs.textContent = 'VS';
      cards.insertBefore(vs, cards.children[1]);
      stage.appendChild(cards);
      const note = document.createElement('p');
      note.className = 'room-note';
      note.textContent = baccaratRoom.note || '';
      stage.appendChild(note);
      const result = document.createElement('div');
      result.className = `client-result ${me.lastResult === 'win' ? '' : me.lastResult === 'loss' ? 'is-loss' : 'is-push'}`;
      result.textContent = me.lastResult === 'win' ? '🎉 你贏了！' : me.lastResult === 'loss' ? '你輸了' : me.lastResult === 'push' ? '和局，下注退回' : '等待下一局';
      stage.appendChild(result);
    }
  }

  function handleBaccaratRoomHostMessage(conn, message) {
    if (!message || typeof message !== 'object') return;
    const p = baccaratRoom.players.find((x) => x.slot === conn.slot);
    if (message.type === 'hello') {
      const slot = clamp(Math.floor(Number(message.slot) || 0), 1, baccaratRoom.players.length);
      conn.slot = slot;
      const player = baccaratRoom.players.find((x) => x.slot === slot);
      const name = validString(message.name, '').trim().slice(0, 14);
      if (player) {
        player.joined = true;
        player.online = true;
        if (name) player.name = name;
      }
      if (!baccaratRoom.conns.some((entry) => entry.conn === conn)) baccaratRoom.conns.push({ conn, slot });
      const joined = baccaratRoom.players.filter((x) => x.joined).length;
      $('#bacRoomStatus').textContent = `房間代號 ${baccaratRoom.code} · 已加入 ${joined}/${baccaratRoom.players.length} 人`;
      $('#bacRoomStatus').hidden = false;
      bacRoomBroadcast();
    } else if (message.type === 'side' && p) {
      if (baccaratRoom.stage !== 'bet') return;
      p.side = ['player', 'banker', 'tie'].includes(message.side) ? message.side : 'player';
      p.locked = false;
      bacRoomBroadcast();
    } else if (message.type === 'bet' && p) {
      if (baccaratRoom.stage !== 'bet') return;
      p.bet = message.amount === 'all' ? p.chips : Math.min(Math.floor(Number(message.amount) || 0), p.chips);
      p.locked = false;
      bacRoomBroadcast();
    } else if (message.type === 'lock' && p) {
      if (baccaratRoom.stage !== 'bet') return;
      if (p.bet <= 0) {
        showToast(`${p.name} 還未選下注金額`);
        return;
      }
      p.locked = true;
      bacRoomBroadcast();
    }
  }

  function createBaccaratRoom() {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    const count = clamp(Math.floor(Number($('#bacRoomPlayers').value) || 4), 2, 8);
    const code = makeRoomCode();
    baccaratRoom.code = code;
    baccaratRoom.mySlot = 0;
    baccaratRoom.conns = [];
    baccaratRoom.players = Array.from({ length: count }, (_, index) => makeRoomPlayer(index + 1, index));
    baccaratRoom.roundNo = 0;
    baccaratRoom.stage = 'lobby';
    baccaratRoom.playerCards = [];
    baccaratRoom.bankerCards = [];
    baccaratRoom.note = '';
    baccaratRoom.route = [];
    baccaratRoom.resultText = '';
    baccaratRoomSetMode('host');
    $('#bacRoomStatus').textContent = '建立中…';
    $('#bacRoomStatus').hidden = false;
    $('#bacQrGrid').hidden = true;
    const peer = new Peer(`${BAC_ROOM_HOST}${code.toLowerCase()}`, { debug: 1 });
    baccaratRoom.peer = peer;
    peer.on('open', () => {
      baccaratRoom.ready = true;
      $('#bacRoomStatus').textContent = `房間代號 ${code} · 等大家掃 QR 加入`;
      $('#bacRoomStatus').hidden = false;
      cardRoomBuildQr($('#bacQrGrid'), 'bac', code, baccaratRoom.players.map((p) => p.slot), '掃描後設定名字，等待押注');
      renderBaccaratRoomStage();
    });
    peer.on('connection', (conn) => cardRoomSetupHostConn(conn, handleBaccaratRoomHostMessage, (closed) => {
      const result = cardRoomRemoveConn(baccaratRoom.conns, closed);
      baccaratRoom.conns = result.conns;
      if (result.removed) {
        const player = baccaratRoom.players.find((x) => x.slot === result.removed.slot);
        if (player) player.online = false;
        const joined = baccaratRoom.players.filter((x) => x.joined).length;
        $('#bacRoomStatus').textContent = `房間代號 ${baccaratRoom.code} · 已加入 ${joined}/${baccaratRoom.players.length} 人`;
        bacRoomBroadcast();
      }
    }));
    peer.on('error', (error) => {
      const type = error && error.type;
      if (type === 'unavailable-id') { showToast('房間代號衝突，請重試'); resetBaccaratRoom(); }
      else showToast('連線暫時不穩，仍在嘗試');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function joinBaccaratRoom(code, slot) {
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入，請確認網路後重整');
      return;
    }
    baccaratRoom.mode = 'client';
    baccaratRoom.code = code;
    baccaratRoom.mySlot = slot;
    baccaratRoom.ready = false;
    baccaratRoom.conns = [];
    baccaratRoom.players = [];
    baccaratRoomSetMode('client');
    $('#bacRoomStatus').hidden = true;
    const peer = new Peer(makeCardClientId(BAC_ROOM_HOST, code, slot), { debug: 1 });
    baccaratRoom.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(`${BAC_ROOM_HOST}${code.toLowerCase()}`, { reliable: true });
      baccaratRoom.conn = conn;
      conn.on('open', () => conn.send({ type: 'hello', slot, name: `玩家 ${slot}` }));
      conn.on('data', (message) => {
        try {
          if (message && message.type === 'state' && Array.isArray(message.players)) {
            baccaratRoom.players = message.players.map((p) => ({
              ...makeRoomPlayer(p.slot, 0),
              name: validString(p.name, `玩家 ${p.slot}`).trim().slice(0, 14) || `玩家 ${p.slot}`,
              chips: clamp(Math.floor(Number(p.chips) || 0), 0, 999999),
              bet: Math.max(0, Math.floor(Number(p.bet) || 0)),
              side: ['player', 'banker', 'tie'].includes(p.side) ? p.side : 'player',
              locked: Boolean(p.locked),
              joined: Boolean(p.joined),
              online: p.online !== false,
              lastResult: p.lastResult || '',
            }));
            baccaratRoom.stage = message.stage || 'lobby';
            baccaratRoom.roundNo = Math.floor(Number(message.roundNo) || 0);
            baccaratRoom.playerCards = Array.isArray(message.playerCards) ? message.playerCards : [];
            baccaratRoom.bankerCards = Array.isArray(message.bankerCards) ? message.bankerCards : [];
            baccaratRoom.note = message.note || '';
            baccaratRoom.resultText = message.resultText || '';
            baccaratRoom.route = Array.isArray(message.route) ? message.route : [];
            baccaratRoom.ready = true;
            renderBaccaratClient();
          }
        } catch (error) { /* ignore */ }
      });
      conn.on('close', () => renderBaccaratClient());
      conn.on('error', () => renderBaccaratClient());
    });
    peer.on('error', () => {
      baccaratRoom.ready = false;
      renderBaccaratClient();
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (err) { /* ignore */ } });
  }

  function resetBaccaratRoom() {
    try { if (baccaratRoom.peer) baccaratRoom.peer.destroy(); } catch (error) { /* ignore */ }
    baccaratRoom.mode = 'local';
    baccaratRoom.code = '';
    baccaratRoom.peer = null;
    baccaratRoom.conns = [];
    baccaratRoom.conn = null;
    baccaratRoom.mySlot = 0;
    baccaratRoom.ready = false;
    baccaratRoom.players = [];
    baccaratRoom.stage = 'lobby';
    baccaratRoom.playerCards = [];
    baccaratRoom.bankerCards = [];
    baccaratRoom.roundNo = 0;
    baccaratRoom.note = '';
    baccaratRoom.route = [];
    baccaratRoom.resultText = '';
    baccaratRoomSetMode('local');
    $('#bacRoom').hidden = true;
    $('#bacSolo').hidden = false;
  }

  $('#createBacRoomButton').addEventListener('click', createBaccaratRoom);
  $('#endBacRoomButton').addEventListener('click', () => {
    resetBaccaratRoom();
    showToast('已結束百家樂房間');
  });

  function resetCardPlaySessions() {
    texasResetChips();
    bjResetChips();
    bacResetChips();
    resetTexasRoom();
    resetBlackjackRoom();
    resetBaccaratRoom();
  }

  renderTexas();
  renderBlackjack();
  renderBaccarat();

  // 全站語音導播總開關(所有遊戲都受它控制,設定會記在本機)
  const voiceToggleButton = $('#voiceToggleButton');
  const voiceToggleIcon = $('#voiceToggleIcon');
  function renderVoiceToggleButton() {
    voiceToggleIcon.textContent = globalVoice ? '🔊' : '🔇';
    voiceToggleButton.classList.toggle('is-muted', !globalVoice);
    voiceToggleButton.setAttribute('aria-label', globalVoice ? '關閉語音提示' : '開啟語音提示');
    voiceToggleButton.title = globalVoice ? '語音導播:開' : '語音導播:關';
  }
  try {
    globalVoice = localStorage.getItem(VOICE_STORAGE_KEY) !== '0';
  } catch (error) {
    globalVoice = true;
  }
  renderVoiceToggleButton();
  voiceToggleButton.addEventListener('click', () => {
    globalVoice = !globalVoice;
    try { localStorage.setItem(VOICE_STORAGE_KEY, globalVoice ? '1' : '0'); } catch (error) { /* ignore */ }
    if (!globalVoice) {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (error) { /* ignore */ }
    }
    renderVoiceToggleButton();
    showToast(globalVoice ? '語音提示已開啟(所有遊戲)' : '語音提示已關閉(所有遊戲)');
  });

  // Clear local data dialog
  const clearDataModal = $('#clearDataModal');
  $('#clearDataButton').addEventListener('click', () => {
    clearDataModal.hidden = false;
    $('#cancelClearButton').focus();
  });
  $('#cancelClearButton').addEventListener('click', () => { clearDataModal.hidden = true; });
  clearDataModal.addEventListener('click', (event) => {
    if (event.target === clearDataModal) clearDataModal.hidden = true;
  });
  $('#confirmClearButton').addEventListener('click', () => {
    window.clearInterval(timerInterval);
    timerInterval = null;
    resetSync();
    resetDiceSync();
    resetWolfSync();
    resetSpySync();
    resetOneNightSync();
    resetAgentSync();
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    state = defaultState();
    resetCardPlaySessions();
    renderDice();
    renderWheelOptions();
    wheelRotation = 0;
    drawWheel();
    renderParticipantInputs();
    renderTeamResult();
    $('#teamSplitStatus').textContent = '平均分配';
    renderScore();
    state.timer.remaining = state.timer.preset;
    updateTimerDisplay();
    saveState();
    clearDataModal.hidden = true;
    showToast('已恢復所有預設內容');
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !clearDataModal.hidden) clearDataModal.hidden = true;
  });

  // Join URLs are handled only after every engine is defined.
  initSyncFromUrl();

  // Initial paint.
  renderDice();
  renderWheelOptions();
  drawWheel();
  if (state.timer.remaining > state.timer.preset) {
    state.timer.remaining = state.timer.preset;
    updateTimerDisplay();
  }

  // Cache the shell for offline use when served from a web origin.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // The app remains fully usable if a browser does not support service workers.
      });
    });
  }
})();
