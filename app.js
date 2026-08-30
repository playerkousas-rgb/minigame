(() => {
  'use strict';

  const STORAGE_KEY = 'pocket-play-state-v1';
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

  // Navigation
  function switchView(viewName) {
    $$('.mode-tab').forEach((tab) => {
      const active = tab.dataset.view === viewName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    $$('.app-view').forEach((view) => {
      const active = view.id === `view-${viewName}`;
      view.classList.toggle('is-active', active);
      view.hidden = !active;
    });
    if (viewName === 'wheel') window.setTimeout(drawWheel, 30);
  }

  $$('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
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
    const slot = Number(params.get('p'));
    if (wolfCode && Number.isFinite(slot) && slot >= 1) {
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

  // Werewolf (secret roles + moderator flow, host + clients via PeerJS)
  const WOLF_HOST_PREFIX = 'pocket-wolf-';
  const wolfSync = {
    mode: 'local',       // 'local' | 'host' | 'client'
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
    if (!wolfSync.config || !wolfSync.config.voice) return;
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
    wolfSync.over = checkWolfWinner();
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
    wolfSync.over = checkWolfWinner();
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
    }
    wolfSync.resultForMe = null;
    wolfSync.players.forEach((player) => { player.acted = false; });
    if (wolfSync.mode === 'host') {
      wolfPhaseLabel.textContent = step.label || '';
      wolfPhaseTitle.textContent = step.title || '';
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
    let text = step.hint || '';
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
      name.textContent = player.name + (player.slot === wolfSync.mySlot ? '（你）' : '');
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

  function renderWolfPhaseActions() {
    wolfPhaseActions.replaceChildren();
    const step = wolfCurrentStep();
    if (!step) return;
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
    } else if (step.target === 'clients') {
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
    if (step.id === 'reveal') {
      const confirmed = wolfSync.players.filter((player) => player.ready).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `已確認 ${confirmed} / ${wolfSync.players.length} 人`;
      wolfPhaseActions.appendChild(note);
    }
    if (step.id === 'over') {
      wolfNextButton.hidden = true;
      const winner = document.createElement('div');
      winner.className = 'wolf-winner';
      winner.textContent = wolfSync.over && wolfSync.over.camp === 'wolf' ? '🐺 狼人陣營獲勝' : '🌞 好人陣營獲勝';
      wolfPhaseActions.appendChild(winner);
    } else {
      wolfNextButton.hidden = false;
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
    wolfSetMode('local');
  }

  function createWolfRoom() {
    if (wolfSync.mode !== 'local') return;
    if (typeof Peer === 'undefined') {
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
    wolfSync.code = code;
    wolfSync.mySlot = 0;
    wolfSync.conns = [];
    wolfSync.config = { roles, voice: wolfVoiceToggle.checked };
    wolfSync.players = roles.map((role, index) => ({
      name: `玩家 ${index + 1}`,
      role,
      alive: true,
      joined: index === 0,
      ready: false,
      acted: false,
      voteLocked: false,
      online: index === 0,
    }));
    wolfSync.steps = [];
    wolfSync.stepIndex = -1;
    wolfSync.night = 0;
    ensureWolfSteps();
    wolfSync.stepIndex = 0;
    wolfSetMode('host');
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
  const SPY_MODE_PRESETS = [
    { id: 'undercover', label: '版本 A · 誰是臥底', desc: '臥底拿到一個相似的詞,要想辦法隱藏自己' },
    { id: 'spyfall', label: '版本 B · 間諜危機', desc: '平民共用同一詞,間諜不知道詞,只能靠問答找破綻' },
  ];
  const spySync = {
    mode: 'local',      // 'local' | 'host' | 'client'
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
    myWord: null,       // client only: my own word (null = spy without a word)
  };
  const spySetupPanel = $('#spySetup');
  const spyHostPanel = $('#spyHost');
  const spyClientPanel = $('#spyClient');
  const spyModeList = $('#spyModeList');
  const spyTheme = $('#spyTheme');
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
  let spySelectedMode = 'undercover';

  function spySpeak(text) {
    if (!spySync.config || !spySync.config.voice) return;
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

  function renderSpyModeList() {
    spyModeList.replaceChildren();
    SPY_MODE_PRESETS.forEach((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wolf-preset' + (index === 0 ? ' is-selected' : '');
      button.dataset.spyMode = preset.id;
      const title = document.createElement('strong');
      title.textContent = preset.label;
      const sub = document.createElement('span');
      sub.textContent = preset.desc;
      button.append(title, sub);
      button.addEventListener('click', () => {
        $$('.wolf-preset', spyModeList).forEach((el) => el.classList.remove('is-selected'));
        button.classList.add('is-selected');
        spySelectedMode = preset.id;
      });
      spyModeList.appendChild(button);
    });
  }

  function spyBuildSteps() {
    const minutes = Number(spySync.config.minutes) || 3;
    return [
      { id: 'reveal', label: '發詞', title: '查看你的詞', hint: '每個人確認自己的詞或身份後按「看完了」。', secs: 0, voice: '每人查看自己手機上的詞,確認後按看完了。' },
      { id: 'discuss', label: '討論', title: '討論時間', hint: '輪流描述自己的詞,找出破綻。', secs: minutes * 60, timer: true, voice: '討論開始,請用問題和描述找出臥底。' },
      { id: 'vote', label: '投票', title: '投票指認', hint: '投給你認為是臥底的人。', secs: 0, voice: '請投票,指認你認為是臥底的人。' },
      { id: 'result', label: '揭曉', title: '揭曉答案', hint: '', secs: 0, voice: '揭曉答案。' },
    ];
  }

  function createSpyRoom() {
    if (spySync.mode !== 'local') return;
    if (typeof Peer === 'undefined') {
      showToast('連線程式未載入,請確認網路後重整');
      return;
    }
    const mode = spySelectedMode;
    const count = clamp(Number(spyCount.value) || 6, 4, 12);
    const spyTotal = clamp(Number(spySpies.value) || 1, 1, 2);
    if (spyTotal >= count) { showToast('臥底人數要比玩家人數少'); return; }
    const themeId = spyTheme.value;
    let word = '';
    let spyWord = '';
    if (themeId === 'custom') {
      word = spyCustomWord.value.trim().slice(0, 12);
      if (!word) { showToast('請輸入平民詞'); return; }
      spyWord = spyCustomSpyWord.value.trim().slice(0, 12);
    } else {
      const theme = SPY_THEMES[themeId] || SPY_THEMES.party;
      if (mode === 'undercover') {
        const pick = theme.pairs[randomInt(theme.pairs.length)];
        word = pick[0];
        spyWord = pick[1];
      } else {
        word = theme.places[randomInt(theme.places.length)];
        spyWord = '';
      }
    }
    const code = makeRoomCode();
    const spySlots = new Set();
    while (spySlots.size < spyTotal) spySlots.add(randomInt(count));
    spySync.code = code;
    spySync.mySlot = 0;
    spySync.conns = [];
    spySync.config = { mode, word, spyWord, minutes: Number(spyMinutes.value) || 3, voice: spyVoiceToggle.checked, spyCount: spyTotal };
    spySync.players = Array.from({ length: count }, (_, index) => ({
      name: `玩家 ${index + 1}`,
      isSpy: spySlots.has(index),
      joined: index === 0,
      ready: false,
      voted: false,
      online: index === 0,
    }));
    spySync.steps = spyBuildSteps();
    spySync.stepIndex = 0;
    spySync.votes = {};
    spySync.over = null;
    spySync.myWord = null;
    spySetMode('host');
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
      // Spy status is secret: only your own is visible.
      myCopy.players = myCopy.players.map((player, index) => (
        index === slot ? player : { ...player, isSpy: null }
      ));
      // Your own word only (spies in spyfall mode have no word).
      if (spySync.config) {
        if (spySync.config.mode === 'undercover') {
          myCopy.myWord = me.isSpy ? spySync.config.spyWord : spySync.config.word;
        } else {
          myCopy.myWord = me.isSpy ? null : spySync.config.word;
        }
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

  function spyEnterStep() {
    const step = spySync.steps[spySync.stepIndex];
    if (!step) return;
    if (step.id === 'vote') spySync.votes = {};
    if (step.id === 'result') spyResolveResult();
    spySync.players.forEach((player) => {
      player.ready = false;
      player.voted = false;
    });
    if (spySync.mode === 'host') {
      spyPhaseLabel.textContent = step.label || '';
      spyPhaseTitle.textContent = step.title || '';
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
    let text = step.hint || '';
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

  function renderSpyPhaseActions() {
    spyPhaseActions.replaceChildren();
    const step = spySync.steps[spySync.stepIndex] || null;
    if (!step) return;
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
        words.textContent = spySync.config.mode === 'undercover'
          ? `平民詞「${spySync.config.word}」 / 臥底詞「${spySync.config.spyWord}」`
          : `地點「${spySync.config.word}」 / 間諜不知道詞`;
        spyPhaseActions.appendChild(words);
      }
      spyNextButton.hidden = true;
      return;
    }
    if (step.id === 'vote') {
      const voted = spySync.players.filter((player) => player.voted).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `已投票 ${voted}/${spySync.players.length} 人。`;
      spyPhaseActions.appendChild(note);
    } else if (step.id === 'reveal') {
      const confirmed = spySync.players.filter((player) => player.ready).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `已確認 ${confirmed}/${spySync.players.length} 人。`;
      spyPhaseActions.appendChild(note);
    }
    spyNextButton.hidden = false;
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

  function spyWordCard() {
    const card = document.createElement('div');
    card.className = 'game-word-card is-hidden';
    const label = document.createElement('span');
    label.className = 'wolf-phase-label';
    const word = document.createElement('strong');
    if (spySync.myWord) {
      label.textContent = '點一下偷看你的詞';
      word.textContent = spySync.myWord;
    } else {
      label.textContent = '點一下查看身份';
      word.textContent = '🕵️ 間諜';
    }
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
      if (isSpy && !spySync.myWord) {
        label.textContent = '你的身份';
        const word = document.createElement('strong');
        word.textContent = '🕵️ 間諜';
        const sub = document.createElement('p');
        sub.className = 'role-desc';
        sub.textContent = '你不知道詞是什麼。想辦法從大家的描述中猜出詞,別被發現!';
        card.append(label, word, sub);
      } else {
        label.textContent = isSpy ? '你的詞（臥底）' : '你的詞';
        const word = document.createElement('strong');
        word.textContent = spySync.myWord || '…';
        const sub = document.createElement('p');
        sub.className = 'role-desc';
        sub.textContent = isSpy ? '你的詞和別人不一樣,描述時不要露餡!' : '大家說的都是這個詞,描述時不要講出關鍵字。';
        card.append(label, word, sub);
      }
      spyClientBody.appendChild(card);
      spyClientBody.appendChild(spyNameEditor());
      spyClientBody.appendChild(buildGameRules('誰是臥底怎麼玩?', [
        '大部分人是同一個詞(平民),少數人拿到相似詞(臥底),輪流描述自己的詞、不能講關鍵字。',
        '討論結束後手機投票抓臥底:投中是臥底 → 平民贏;沒抓到 → 臥底贏。',
        '「間諜危機」版:平民共用地點詞,間諜不知道詞,靠問答找破綻。',
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

  spyTheme.addEventListener('change', () => {
    spyCustom.hidden = spyTheme.value !== 'custom';
  });
  $('#createSpyRoomButton').addEventListener('click', createSpyRoom);
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
  renderSpyModeList();
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

  function oneRoleById(id) {
    return ONE_ROLES[id] || { name: '村民', emoji: '👤', camp: 'village', desc: '' };
  }

  function oneSpeak(text) {
    if (!oneSync.config || !oneSync.config.voice) return;
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
    if (typeof Peer === 'undefined') {
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
    oneSync.code = code;
    oneSync.mySlot = 0;
    oneSync.conns = [];
    oneSync.config = { roles, voice: oneVoiceToggle.checked };
    oneSync.players = roles.map((role, index) => ({
      name: `玩家 ${index + 1}`,
      role,
      initialRole: role,
      joined: index === 0,
      ready: false,
      acted: false,
      voted: false,
      online: index === 0,
    }));
    oneSync.steps = oneBuildSteps();
    oneSync.stepIndex = 0;
    oneSync.targets = {};
    oneSync.votes = {};
    oneSync.over = null;
    oneSync.resultForMe = null;
    oneSync.wolfMates = [];
    oneSetMode('host');
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
      if (!oneSync.players[slot]) return;
      const step = oneSync.steps[oneSync.stepIndex] || null;
      const pick = validString(message.pick, '');
      if (step && step.pick === pick && oneSync.players[slot].role === step.role) {
        oneSync.players[slot].acted = true;
        if (pick === 'check') {
          const target = clamp(Math.floor(Number(message.target)), 0, oneSync.players.length - 1);
          oneSync.targets.seer = target;
          const targetRole = oneSync.players[target].initialRole;
          oneSync.resultForMe = {
            forSlot: slot,
            kind: 'check',
            targetName: oneSync.players[target].name,
            isWolf: targetRole === 'werewolf',
          };
        } else if (pick === 'rob') {
          const target = clamp(Math.floor(Number(message.target)), 0, oneSync.players.length - 1);
          if (target === slot) return;
          const robberOld = oneSync.players[slot].role;
          const victimOld = oneSync.players[target].role;
          oneSync.players[slot].role = victimOld;
          oneSync.players[target].role = robberOld;
          oneSync.targets.rob = target;
          oneSync.resultForMe = { forSlot: slot, kind: 'role', roleId: victimOld };
        } else if (pick === 'swap2') {
          const targets = Array.isArray(message.targets) ? message.targets.map((value) => clamp(Math.floor(Number(value)), 0, oneSync.players.length - 1)) : [];
          if (targets.length === 2 && targets[0] !== targets[1] && !targets.includes(slot)) {
            const roleA = oneSync.players[targets[0]].role;
            const roleB = oneSync.players[targets[1]].role;
            oneSync.players[targets[0]].role = roleB;
            oneSync.players[targets[1]].role = roleA;
            oneSync.targets.swap2 = targets;
          }
        } else if (pick === 'self') {
          oneSync.resultForMe = { forSlot: slot, kind: 'role', roleId: oneSync.players[slot].role };
        }
        broadcastOneState();
      }
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

  function oneEnterStep() {
    const step = oneSync.steps[oneSync.stepIndex];
    if (!step) return;
    if (step.id === 'wolves') {
      oneSync.wolfMates = oneSync.players.map((player, index) => (player.initialRole === 'werewolf' ? index : -1)).filter((index) => index >= 0);
    }
    if (step.id === 'night-open') {
      oneSync.targets = {};
      oneSync.resultForMe = null;
    }
    if (step.id === 'dawn') oneSync.resultForMe = null;
    if (step.id === 'vote') oneSync.votes = {};
    if (step.id === 'result') oneResolveResult();
    oneSync.players.forEach((player) => {
      player.ready = false;
      player.acted = false;
      player.voted = false;
    });
    if (oneSync.mode === 'host') {
      onePhaseLabel.textContent = step.label || '';
      onePhaseTitle.textContent = step.title || '';
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
    let text = step.hint || '';
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
    let stateText = '';
    if (stepId === 'vote') stateText = `· 已投票 ${voted}/${oneSync.players.length}`;
    else if (stepId === 'reveal') stateText = `· 已確認 ${ready}/${oneSync.players.length}`;
    left.textContent = `身份總覽（貓紙）${stateText}`;
    heading.appendChild(left);
    oneRoster.appendChild(heading);
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

  function renderOnePhaseActions() {
    onePhaseActions.replaceChildren();
    const step = oneSync.steps[oneSync.stepIndex] || null;
    if (!step) return;
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
      const voted = oneSync.players.filter((player) => player.voted).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `已投票 ${voted}/${oneSync.players.length} 人。`;
      onePhaseActions.appendChild(note);
    } else if (step.id === 'reveal') {
      const ready = oneSync.players.filter((player) => player.ready).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `已確認 ${ready}/${oneSync.players.length} 人。`;
      onePhaseActions.appendChild(note);
    } else if (step.target === 'client' && step.role) {
      const roleInfo = oneRoleById(step.role);
      const acted = oneSync.players.filter((player) => player.acted).length;
      const note = document.createElement('p');
      note.className = 'wolf-custom-summary';
      note.textContent = `等 ${roleInfo.name} 在手機上行動${acted ? '（已完成）' : ''}。`;
      onePhaseActions.appendChild(note);
    }
    oneNextButton.hidden = false;
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
      name.textContent = player.name + (player.slot === oneSync.mySlot ? '（你）' : '');
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

  function agentSpeak(text) {
    if (!agentSync.config || !agentSync.config.voice) return;
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
    if (typeof Peer === 'undefined') {
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
    agentSync.code = code;
    agentSync.mySlot = 0;
    agentSync.conns = [];
    agentSync.config = { words, key, voice: agentVoiceSelect.value !== '0', teamSize, first };
    agentSync.players = roles.map((role, index) => ({
      name: `玩家 ${index + 1}`,
      team: role.team,
      captain: role.captain,
      joined: false,
      ready: false,
      online: false,
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
  }

  function agentEnterOver() {
    const overIndex = agentSync.steps.findIndex((step) => step.id === 'over');
    if (overIndex >= 0) {
      agentSync.steps[overIndex].voice = `${agentSync.winner === 'red' ? '紅隊' : '藍隊'}獲勝!`;
      agentSync.stepIndex = overIndex;
    }
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
      agentPhaseLabel.textContent = step.label || '';
      agentPhaseTitle.textContent = step.title || '';
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

  function renderAgentPhaseActions() {
    agentPhaseActions.replaceChildren();
    const step = agentSync.steps[agentSync.stepIndex] || null;
    if (!step) return;
    if (step.id === 'reveal') {
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
      agentHostGrid.appendChild(agentBuildGrid({ showKey: true, key: agentSync.config.key }));
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
  $('#createAgentRoomButton').addEventListener('click', createAgentRoom);
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
