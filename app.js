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
  const RPS_LABELS = { rock: '石頭', paper: '布', scissors: '剪刀' };
  const RPS_EMOJI = { rock: '✊', paper: '✋', scissors: '✌' };
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
    pickerEntries: '阿明\n小美\n阿哲\n小安',
    score: {
      a: 0,
      b: 0,
      aName: '我們隊',
      bName: '朋友隊',
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

      return {
        dice: {
          count,
          sides,
          values,
          rolls: Math.max(1, Math.floor(Number(dice.rolls) || initial.dice.rolls)),
        },
        wheel: { options: options.length >= 2 ? options : [...initial.wheel.options] },
        pickerEntries: validString(saved.pickerEntries, initial.pickerEntries),
        score: {
          a: Math.max(0, Math.floor(Number(saved.score?.a) || 0)),
          b: Math.max(0, Math.floor(Number(saved.score?.b) || 0)),
          aName: validString(saved.score?.aName, initial.score.aName).slice(0, 10),
          bName: validString(saved.score?.bName, initial.score.bName).slice(0, 10),
        },
        timer: {
          preset: [30, 60, 180].includes(Number(saved.timer?.preset)) ? Number(saved.timer.preset) : initial.timer.preset,
          remaining: clamp(Math.floor(Number(saved.timer?.remaining) || Number(saved.timer?.preset) || initial.timer.remaining), 0, 3600),
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
  let pickerResultTimeout;

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

  // Random picker
  const pickerEntries = $('#pickerEntries');
  const pickerCount = $('#pickerCount');
  const pickerResult = $('#pickerResult');

  function getPickerValues() {
    return pickerEntries.value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  function updatePickerCount() {
    const count = getPickerValues().length;
    pickerCount.textContent = `${count} 個選項`;
    state.pickerEntries = pickerEntries.value;
    saveState();
  }

  pickerEntries.value = state.pickerEntries;
  pickerEntries.addEventListener('input', updatePickerCount);
  $('#pickButton').addEventListener('click', () => {
    const entries = getPickerValues();
    if (!entries.length) {
      pickerResult.textContent = '先放入幾個選項吧';
      showToast('抽選名單還是空的');
      return;
    }
    const picked = entries[randomInt(entries.length)];
    pickerResult.classList.remove('is-picked');
    void pickerResult.offsetWidth;
    pickerResult.classList.add('is-picked');
    pickerResult.textContent = `✦ ${picked}`;
    window.clearTimeout(pickerResultTimeout);
    pickerResultTimeout = window.setTimeout(() => pickerResult.classList.remove('is-picked'), 700);
    vibrate(25);
  });
  updatePickerCount();

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

  // Rock-paper-scissors
  $$('.rps-buttons button').forEach((button) => {
    button.addEventListener('click', () => {
      const userChoice = button.dataset.rps;
      const choices = Object.keys(RPS_LABELS);
      const appChoice = choices[randomInt(choices.length)];
      let outcome = '平手，再來一局';
      if ((userChoice === 'rock' && appChoice === 'scissors') || (userChoice === 'paper' && appChoice === 'rock') || (userChoice === 'scissors' && appChoice === 'paper')) {
        outcome = '你贏了！';
      } else if (userChoice !== appChoice) {
        outcome = '手機贏了';
      }
      $$('.rps-buttons button').forEach((item) => item.classList.toggle('is-selected', item === button));
      const result = $('#rpsResult');
      result.classList.remove('is-new');
      void result.offsetWidth;
      result.classList.add('is-new');
      result.textContent = `${RPS_EMOJI[userChoice]} ${RPS_LABELS[userChoice]}  vs  ${RPS_EMOJI[appChoice]} ${RPS_LABELS[appChoice]} · ${outcome}`;
      vibrate(25);
    });
  });

  // Scoreboard
  const teamAName = $('#teamAName');
  const teamBName = $('#teamBName');
  const teamAScore = $('#teamAScore');
  const teamBScore = $('#teamBScore');

  function renderScore() {
    teamAName.value = state.score.aName;
    teamBName.value = state.score.bName;
    teamAScore.textContent = state.score.a;
    teamBScore.textContent = state.score.b;
  }

  $$('.score-buttons button').forEach((button) => {
    button.addEventListener('click', () => {
      const team = button.dataset.team;
      const change = Number(button.dataset.scoreChange);
      state.score[team] = Math.max(0, state.score[team] + change);
      saveState();
      renderScore();
      vibrate(18);
    });
  });

  teamAName.addEventListener('input', () => {
    state.score.aName = teamAName.value.slice(0, 10);
    saveState();
  });
  teamBName.addEventListener('input', () => {
    state.score.bName = teamBName.value.slice(0, 10);
    saveState();
  });
  $('#resetScoreButton').addEventListener('click', () => {
    state.score.a = 0;
    state.score.b = 0;
    saveState();
    renderScore();
    showToast('分數已重設');
  });
  renderScore();

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
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    state = defaultState();
    pickerEntries.value = state.pickerEntries;
    renderDice();
    renderWheelOptions();
    wheelRotation = 0;
    drawWheel();
    updatePickerCount();
    renderScore();
    state.timer.remaining = state.timer.preset;
    updateTimerDisplay();
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
