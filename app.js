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

  function renderDice(animate = false) {
    diceGrid.replaceChildren();
    state.dice.values.forEach((value, index) => {
      const die = document.createElement('div');
      die.className = 'die';
      die.setAttribute('aria-label', `第 ${index + 1} 顆骰子`);
      const dieValue = document.createElement('span');
      dieValue.className = 'die-value';
      dieValue.setAttribute('aria-hidden', 'true');
      if (state.dice.sides === 6) {
        dieValue.appendChild(createPipFace(value));
      } else {
        const numeric = document.createElement('span');
        numeric.className = 'numeric-face';
        numeric.textContent = String(value);
        dieValue.appendChild(numeric);
      }
      die.appendChild(dieValue);
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
    showToast('模擬搖動 · 骰子已換面');
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

  function buildQrCard(slot, url) {
    const card = document.createElement('div');
    card.className = 'qr-card';
    const label = document.createElement('strong');
    label.textContent = `玩家 ${slot + 1}`;
    const sub = document.createElement('span');
    sub.className = 'qr-card-sub';
    sub.textContent = `掃描後以「玩家 ${slot + 1}」加入`;
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
      showToast('連線程式未載入');
      setScoreMode('local');
      updateSyncStatus('連線程式未載入，請確認網路後重整');
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
    const code = (params.get('join') || '').trim();
    const slot = Number(params.get('p'));
    if (code && Number.isFinite(slot) && slot >= 1) {
      switchView('tools');
      joinRoom(code.toUpperCase(), clamp(Math.floor(slot), 1, 12));
    }
  }

  $('#createRoomButton').addEventListener('click', createRoom);
  endRoomButton.addEventListener('click', () => {
    resetSync();
    showToast('已結束連線');
  });
  initSyncFromUrl();

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
