/* Connects the real evolutionary trainer to the existing workshop UI. */
const realTrainer = new RealTrainer();
let realLast = 0;
let realDuration = 10;
let trainingStepBudget = 0;
let trainingRunSteps = 0;
let evaluationLast = 0;
let evaluationStepBudget = 0;
const TRAINING_STEPS_PER_SECOND = { initial: 120, additional: 120 };
let activeTrainingStepsPerSecond = TRAINING_STEPS_PER_SECOND.initial;
const EVALUATION_STEPS_PER_SECOND = 60;

function drawRealNetwork(brain) {
  const canvas = $('#network');
  if (!canvas || !brain) return;
  const g = canvas.getContext('2d');
  const layers = [7, 8, 2];
  const xs = [22, 115, 208];
  const nodes = layers.map((count, layer) => Array.from({ length: count }, (_, index) => ({
    x: xs[layer], y: 12 + (index + 1) * 98 / (count + 1)
  })));
  g.clearRect(0, 0, canvas.width, canvas.height);
  let cursor = 0;
  for (let layer = 0; layer < 2; layer++) {
    for (const from of nodes[layer]) {
      for (const to of nodes[layer + 1]) {
        const weight = brain.weights[cursor++];
        const strength = Math.min(1, Math.abs(weight));
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.lineTo(to.x, to.y);
        g.strokeStyle = weight >= 0
          ? `rgba(24,217,220,${0.08 + strength * 0.8})`
          : `rgba(255,84,117,${0.08 + strength * 0.8})`;
        g.lineWidth = 0.35 + strength * 2.2;
        g.stroke();
      }
    }
  }
  nodes.forEach((layer, layerIndex) => layer.forEach(node => {
    g.beginPath();
    g.arc(node.x, node.y, layerIndex === 1 ? 3.1 : 4, 0, Math.PI * 2);
    g.fillStyle = layerIndex === 0 ? '#8465ff' : layerIndex === 1 ? '#d9faff' : '#49f2a5';
    g.fill();
  }));
  g.fillStyle = '#617b8d';
  g.font = '9px Inter,sans-serif';
  g.textAlign = 'center';
  g.fillText('STATE ×7', 22, 121);
  g.fillText('HIDDEN ×8', 115, 121);
  g.fillText('MOTOR ×2', 208, 121);
}

function evaluationStatus(agent) {
  if (agent.reached) return { label: 'GOAL', color: '#49f2a5' };
  if (agent.crashed) return { label: 'CRASH', color: '#ff5475' };
  if (!agent.alive) return { label: 'OUT', color: '#ff8b48' };
  if (realTrainer.steps >= 300) return { label: 'TIME', color: '#ffd166' };
  return { label: 'RUN', color: '#18d9dc' };
}

function drawEvaluationWorld() {
  const columns = 4;
  const rows = 3;
  const cellWidth = sim.width / columns;
  const cellHeight = sim.height / rows;
  const scale = Math.min((cellWidth - 16) / sim.width, (cellHeight - 34) / sim.height);

  Array.from({ length: 12 }, (_, environmentIndex) => {
    const agents = realTrainer.agents.filter(agent => agent.environmentIndex === environmentIndex);
    const representative = agents[0];
    if (!representative) return;
    const row = Math.floor(environmentIndex / columns);
    const column = environmentIndex % columns;
    const cellX = column * cellWidth;
    const cellY = row * cellHeight;
    const fieldWidth = sim.width * scale;
    const fieldHeight = sim.height * scale;
    const offsetX = cellX + (cellWidth - fieldWidth) / 2;
    const offsetY = cellY + 27;
    const successes = agents.filter(agent => agent.reached).length;
    const crashes = agents.filter(agent => agent.crashed).length;
    const alive = agents.filter(agent => agent.alive).length;
    const complete = realTrainer.steps >= 300 || alive === 0;
    const color = !complete ? '#18d9dc' : successes >= 7 ? '#49f2a5' : successes >= 4 ? '#ffd166' : '#ff5475';
    const averageReward = agents.reduce((sum, agent) => sum + agent.reward, 0) / agents.length;

    ctx.fillStyle = '#07141fee';
    ctx.fillRect(cellX + 5, cellY + 5, cellWidth - 10, cellHeight - 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = complete ? 2 : 1;
    ctx.strokeRect(cellX + 5, cellY + 5, cellWidth - 10, cellHeight - 10);

    ctx.fillStyle = '#d7e8f2';
    ctx.font = 'bold 11px Inter,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`T${String(environmentIndex + 1).padStart(2, '0')}`, cellX + 12, cellY + 20);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(complete ? `${successes}/10 GOAL` : `${alive}/10 RUN`, cellX + cellWidth / 2, cellY + 20);
    ctx.fillStyle = '#7890a2';
    ctx.textAlign = 'right';
    ctx.fillText(`C ${crashes} · R ${signed(averageReward)}`, cellX + cellWidth - 12, cellY + 20);

    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, fieldWidth, fieldHeight);
    ctx.clip();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#0a1925';
    ctx.fillRect(0, 0, sim.width, sim.height);
    ctx.strokeStyle = '#29485a';
    ctx.lineWidth = 3 / scale;
    ctx.strokeRect(35, 30, 830, 460);

    const obstacles = representative.obstacles || [];
    for (const obstacle of obstacles) {
      ctx.beginPath();
      ctx.arc(obstacle.x, obstacle.y, obstacle.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8b4844';
      ctx.fill();
      ctx.strokeStyle = '#ff8b48';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(realTrainer.goal.x, realTrainer.goal.y, realTrainer.goalRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#8465ff44';
    ctx.fill();
    ctx.strokeStyle = '#a58cff';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    for (const agent of agents) {
      if (agent.path.length > 1) {
        ctx.beginPath();
        agent.path.forEach((point, pointIndex) => ctx[pointIndex ? 'lineTo' : 'moveTo'](point.x, point.y));
        ctx.strokeStyle = agent.reached ? '#49f2a566' : agent.crashed ? '#ff547544' : '#18d9dc44';
        ctx.lineWidth = 1.4 / scale;
        ctx.stroke();
      }
      const state = evaluationStatus(agent);
      ctx.save();
      ctx.translate(agent.x, agent.y);
      ctx.rotate(agent.angle);
      ctx.fillStyle = state.color;
      ctx.fillRect(-7, -5, 14, 10);
      ctx.restore();
    }
    ctx.restore();
  });

  ctx.fillStyle = '#71899b';
  ctx.font = '10px Inter,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('12 ENVIRONMENTS × 10 START ANGLES · 120 TRIALS · NO LEARNING', sim.width / 2, sim.height - 7);
}
function drawTrainingWorld() {
  grid();
  ctx.beginPath();
  if (realTrainer.isEvaluating) {
    drawEvaluationWorld();
    drawRealNetwork(trainingCandidate);
    return;
  }
  ctx.arc(realTrainer.goal.x, realTrainer.goal.y, realTrainer.goalRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#8465ff33';
  ctx.fill();
  ctx.strokeStyle = '#8d70ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#c7bbff';
  ctx.font = 'bold 16px Inter,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', realTrainer.goal.x, realTrainer.goal.y + 4);

  obs.forEach((obstacle, index) => {
    ctx.beginPath();
    ctx.arc(obstacle.x, obstacle.y, obstacle.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8b4828';
    ctx.fill();
    ctx.strokeStyle = '#ff8b48';
    ctx.lineWidth = 2;
    ctx.stroke();
    const matPoint = simToMat(obstacle.x, obstacle.y);
    const matX = Math.round(matPoint.x);
    const matY = Math.round(matPoint.y);
    ctx.fillStyle = '#ffb17f';
    ctx.font = '14px Inter,sans-serif';
    ctx.fillText(`O${index + 1}`, obstacle.x, obstacle.y + 3);
    ctx.fillStyle = '#9aabbb';
    ctx.font = '11px Inter,sans-serif';
    ctx.fillText(`(${matX}, ${matY})`, obstacle.x, obstacle.y + obstacle.r + 13);
  });

  const visibleAgents = realTrainer.isEvaluating ? realTrainer.agents.slice(0, 1) : realTrainer.agents;
  const best = realTrainer.isEvaluating ? visibleAgents[0] : realTrainer.bestAgent();
  for (const agent of visibleAgents) {
    if (agent.path.length > 1) {
      ctx.beginPath();
      agent.path.forEach((point, index) => ctx[index ? 'lineTo' : 'moveTo'](point.x, point.y));
      ctx.strokeStyle = agent === best ? '#18d9dcaa' : '#18d9dc16';
      ctx.lineWidth = agent === best ? 2 : 1;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(agent.x, agent.y);
    ctx.rotate(agent.angle);
    ctx.fillStyle = agent.reached ? '#49f2a5' : agent.crashed ? '#ff5475' : agent === best ? '#d9ffff' : '#18d9dc55';
    ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = '#06111c';
    ctx.fillRect(1, -2, 7, 4);
    ctx.restore();
  }

  const transferred = window.trainedPolicy;
  if (transferred && transferred.path && transferred.path.length > 1) {
    ctx.beginPath();
    transferred.path.forEach((point, index) => ctx[index ? "lineTo" : "moveTo"](point.x, point.y));
    ctx.strokeStyle = "#49f2a5";
    ctx.lineWidth = 6;
    ctx.shadowColor = "#49f2a5";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#49f2a5";
    ctx.font = "bold 13px Inter,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("TRANSFERRED POLICY / 実機へ送る軌跡", 320, 45);
  }

  if (best) {
    const features = realTrainer.inputs(best);
    const motors = realTrainer.motorOutputs(best.brain, features);
    ctx.fillStyle = '#07141fdd';
    ctx.fillRect(42, 35, 260, 110);
    ctx.strokeStyle = '#29485a';
    ctx.strokeRect(42, 35, 260, 110);
    ctx.fillStyle = '#6f899b';
    ctx.font = '11px Inter,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`GENERATION ${realTrainer.generation} · ${realTrainer.populationSize} ROBOTS`, 57, 53);
    ctx.fillStyle = '#e9f8ff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(best.reached ? 'ゴール方策を発見！' : '実報酬から重みを更新中…', 57, 74);
    ctx.font = '11px Inter,sans-serif';
    ctx.fillStyle = '#8465ff';
    ctx.fillText(`GOAL DIST ${features[0].toFixed(2)}`, 57, 94);
    ctx.fillStyle = '#ff8b48';
    ctx.fillText(`OBSTACLE ${features[3].toFixed(2)}`, 155, 94);
    ctx.fillStyle = '#18d9dc';
    ctx.fillText(`MOTOR L ${motors[0].toFixed(2)}`, 57, 113);
    ctx.fillStyle = '#49f2a5';
    ctx.fillText(`MOTOR R ${motors[1].toFixed(2)}`, 155, 113);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`MUTATION ${(0.015 + S.speed / 70).toFixed(2)}`, 57, 132);
    ctx.fillStyle = best.turnGrip < 0.5 ? "#ff5475" : "#49f2a5";
    ctx.fillText(`APPROACH ×${(S.safety / 25).toFixed(1)}`, 155, 132);
  }
  drawRealNetwork(realTrainer.bestEver || (best && best.brain));
}

function updateRealMetrics() {
  const elapsedRatio = Math.min(1, S.elapsed / realDuration);
  const success = realTrainer.successRate();
  const objectiveStrength = Math.min(1, (S.safety + S.goal + S.crash) / 120);
  const intelligence = Math.min(1, (realTrainer.generation / 18 * 0.55 + success / 100 * 0.45) * objectiveStrength);
  const level = Math.min(5, Math.floor(intelligence * 6));
  const stages = ['重みをランダム生成', '報酬を比較中', '接近行動を獲得', '衝突回避を獲得', '経路を最適化', '方策が完成！'];
  $('#count').textContent = Math.max(0, realDuration - S.elapsed).toFixed(1);
  $('#trials').textContent = realTrainer.evaluations.toLocaleString();
  $('#success').textContent = `${success}%`;
  $('#crashes').textContent = realTrainer.crashes.toLocaleString();
  $('#ring').style.background = `conic-gradient(var(--cyan) ${elapsedRatio * 100}%,#1b3243 0)`;
  $('#reward').textContent = realTrainer.bestEver ? Math.round(realTrainer.bestEver.fitness) : '0';
  const hint = objectiveStrength === 0 ? "報酬がすべて0：良い行動を区別できません" : S.speed > 85 ? "探索過多：良い方策が定着しにくい" : S.speed < 20 ? "探索不足：局所解から抜けにくい" : (S.safety > 85 && S.goal < 55) ? "接近報酬過多：近づくだけで満足する可能性" : S.goal < 35 ? "ゴール報酬不足：最後まで到達する理由が弱い" : S.crash > 90 ? "衝突罰過多：動かない方策に注意" : "探索・接近・到達・衝突罰のバランスを評価中";
  $("#log").textContent = `世代 ${realTrainer.generation}：${hint}`;
  $('#intelLevel').textContent = level;
  $('#intelBar').style.width = `${intelligence * 100}%`;
  document.querySelector("#intelStage").textContent = objectiveStrength === 0 ? "学習目標がありません" : stages[level];
  $('#dangerCount').textContent = Math.min(4, Math.floor(realTrainer.generation / 4 * S.crash / 100));
  $('#ruleCount').textContent = Math.min(12, Math.floor(intelligence * 12));
  chart(intelligence);
}

const trainingHistory = [];
let trainingCandidate = null;
let baselineObservation = false;
let historicalBest = null;
let accumulatedTrainingSeconds = 0;
let currentRunBest = null;
let experimentLog = [];
try { localStorage.removeItem('rl-lab-experiment-log-v1'); } catch (_) {}

function recordExperiment(snapshot, accepted) {
  const result = snapshot.evaluation;
  const environments = trainingHistory.map(item => item.environmentId || item.environment).filter(Boolean);
  const previous = experimentLog[experimentLog.length - 1];
  const lesson = rewardLesson(result, previous ? {
    successes: previous.successes,
    averageReward: previous.averageReward
  } : null);
  experimentLog.push({
    id: Date.now() + experimentLog.length,
    createdAt: Date.now(),
    rewards: { ...snapshot.rewards },
    difficulty: snapshot.difficulty,
    trainingSeconds: snapshot.trainingSeconds || 0,
    generation: snapshot.generation || 0,
    environments: environments.length ? environments : [snapshot.environmentId || 'E05'],
    successes: result.successes,
    crashes: result.crashes,
    environmentResults: result.environmentResults || [],
    averageReward: Math.round(result.averageReward),
    deploymentScore: Math.round(result.deploymentScore),
    passed: result.passed,
    accepted,
    rewardLesson: lesson.type
  });
  experimentLog = experimentLog.slice(-50);
  fetch('/experiment-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(experimentLog[experimentLog.length - 1])
  }).catch(() => {});
  renderExperimentLog();
}

function renderExperimentLog() {
  const panel = $('#experimentLogPanel');
  const rows = $('#experimentLogRows');
  if (!panel || !rows) return;
  panel.classList.toggle('hidden', experimentLog.length === 0);
  if (!experimentLog.length) {
    rows.innerHTML = '';
    return;
  }
  const stages = { 0: '無', 35: '弱', 70: '中', 100: '強' };
  const best = experimentLog.reduce((champion, item) => {
    if (!champion || (item.passed && !champion.passed)) return item;
    if (item.passed === champion.passed && item.deploymentScore > champion.deploymentScore) return item;
    return champion;
  }, null);
  rows.innerHTML = [...experimentLog].reverse().slice(0, 12).map((item, index) => {
    const rewards = item.rewards || {};
    const trialNumber = experimentLog.length - index;
    const route = (item.environments || ['E05']).join('→');
    const settings = `探${stages[rewards.speed] || '?'} 接${stages[rewards.safety] || '?'} ゴ${stages[rewards.goal] || '?'} 衝${stages[rewards.crash] || '?'}`;
    const decision = item.accepted === false ? '見送り' : '採用';
    const lessonLabel = {
      trap: '⚠ 点数のワナ',
      aligned: '点数とゴールが一致',
      'goal-first': 'ゴールを優先',
      neutral: '要比較'
    }[item.rewardLesson] || '';
    return `<div class="experiment-log-row ${item.id === best.id ? 'best' : ''} ${item.accepted === false ? 'rejected' : ''} ${item.rewardLesson === 'trap' ? 'reward-trap' : ''}"><b>#${trialNumber}${item.id === best.id ? ' BEST' : ''}<small>${decision}</small></b><span>${settings}</span><span>${route}・${Number(item.trainingSeconds) || 0}秒・${Number(item.generation) || 0}世代</span><strong>${Number(item.successes) || 0}/120</strong><small>衝突 ${Number(item.crashes) || 0}・AI点 ${Number(item.averageReward) || 0}${lessonLabel ? `・${lessonLabel}` : ''}</small></div>`;
  }).join('');
}

$('#clearExperimentLog').onclick = () => {
  if (!confirm('このページの試行ログをすべて消去しますか？')) return;
  experimentLog = [];
  renderExperimentLog();
};
renderExperimentLog();


function candidateFromTraining() {
  const source = realTrainer.bestSuccessful || realTrainer.bestEver;
  if (!source) return null;
  return {
    weights: [...source.weights],
    fitness: source.fitness,
    trainingBreakdown: source.rewardBreakdown ? { ...source.rewardBreakdown } : null,
    rewards: { speed: S.speed, safety: S.safety, goal: S.goal, crash: S.crash },
    difficulty: S.difficulty,
    environment: currentLayout,
    environmentId: S.environmentId,
    environmentDifficulty: selectedTrainingEnvironment().rank,
    generation: realTrainer.generation,
    evaluations: realTrainer.evaluations,
    trainingSeconds: accumulatedTrainingSeconds
  };
}

function signed(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function rewardLesson(current, reference = null) {
  if (!reference) {
    return {
      type: 'baseline',
      title: '報酬は「学習の手掛かり」です',
      body: 'AIが集めた点数は最終成績ではありません。次の試行から、本番テストのゴール数と一緒に比べます。'
    };
  }
  const rewardDelta = Math.round(current.averageReward - reference.averageReward);
  const goalDelta = current.successes - reference.successes;
  if (rewardDelta >= 80 && goalDelta <= 0) {
    return {
      type: 'trap',
      title: '報酬のワナを発見',
      body: `AIが集めた点数は ${signed(rewardDelta)} ですが、本番のゴールは ${signed(goalDelta)}。高得点の取り方を覚えても、目的を達成したとは限りません。`
    };
  }
  if (rewardDelta > 0 && goalDelta > 0) {
    return {
      type: 'aligned',
      title: '報酬と目的が同じ方向です',
      body: `AIが集めた点数 ${signed(rewardDelta)}、本番のゴール ${signed(goalDelta)}。今回の報酬は、ゴールへ導く手掛かりとして働いています。`
    };
  }
  if (rewardDelta <= 0 && goalDelta > 0) {
    return {
      type: 'goal-first',
      title: '点数より本番結果を優先しよう',
      body: `AIが集めた点数は ${signed(rewardDelta)} でも、本番のゴールは ${signed(goalDelta)}。点数が下がっても、実際にゴールできる方が良い結果です。`
    };
  }
  return {
    type: 'neutral',
    title: '点数だけで良し悪しを決めない',
    body: `AIが集めた点数 ${signed(rewardDelta)}、本番のゴール ${signed(goalDelta)}。衝突数も見て、次は報酬を1項目だけ変えて確かめましょう。`
  };
}

function groupedBreakdown(result) {
  const b = result.breakdown;
  return [
    ['接近', b.approach],
    ['ゴール', b.goal + b.speed],
    ['安全', b.collision + b.clearance + b.boundary],
    ['操作', b.energy + b.turning],
    ['未完走', b.unfinished]
  ];
}

function evaluationMarkup(snapshot, isChampion = false) {
  if (!snapshot) return '<p class="empty-evaluation">比較対象はまだありません</p>';
  const result = snapshot.evaluation;
  const settings = snapshot.rewards;
  const stages = { 0: '無', 35: '弱', 70: '中', 100: '強' };
  const difficulty = { easy: '初級', standard: '中級', challenge: '上級' }[snapshot.difficulty] || '中級';
  const environmentLabel = snapshot.environment || snapshot.environmentId || 'E05';
  const rows = groupedBreakdown(result).map(([label, value]) => {
    const width = Math.min(100, Math.abs(value) / 3.5);
    return `<div class="reward-row"><span>${label}</span><i class="${value >= 0 ? 'positive' : 'negative'}" style="--value:${width}%"></i><b>${signed(value)}</b></div>`;
  }).join('');
  return `
    <div class="parameter-showcase"><b>選んだパラメータ</b><div><span><small>探索</small><strong>${stages[settings.speed]}</strong></span><span><small>接近</small><strong>${stages[settings.safety]}</strong></span><span><small>ゴール</small><strong>${stages[settings.goal]}</strong></span><span><small>衝突罰</small><strong>${stages[settings.crash]}</strong></span></div></div>
    <div class="evaluation-score"><b>${result.successRate}%<small><span>${result.successes}/120</span> GOAL</small></b><strong class="${result.passed ? 'pass' : 'retry'}">${result.passed ? '実機候補' : '要改善'}<small>評価判定</small></strong></div>
    <div class="evaluation-facts"><span>学習時間 <b>${snapshot.trainingSeconds || 0}秒</b></span><span>走行・学習環境 <b>${difficulty}・${environmentLabel}</b></span><span>本番テストの衝突 <b>${result.crashes}/120</b></span><span>AIが集めた点数 <b>${signed(result.averageReward)}</b></span></div>
    <div class="environment-results">${(result.environmentResults || []).map(item => `<span class="${item.successes >= 7 ? 'stable' : item.successes >= 4 ? 'mixed' : 'weak'}"><b>T${String(item.environmentIndex + 1).padStart(2, '0')}</b><strong>${item.successes}/10</strong></span>`).join('')}</div>
    <details class="reward-details"><summary>学習用の点数の内訳を見る</summary><div class="reward-breakdown">${rows}</div></details>
    ${isChampion ? '<em class="champion-badge">実機へ転送するモデル</em>' : ''}`;
}

function evaluationAdvice(snapshot, retainedPrevious = false) {
  const result = snapshot.evaluation;
  const rewards = snapshot.rewards;
  const seconds = snapshot.trainingSeconds || 0;
  const environmentDifficulty = snapshot.environmentDifficulty || 'balanced';
  const allStrong = Object.values(rewards).every(value => value === 100);
  const crashRate = result.attempts ? result.crashes / result.attempts * 100 : 0;
  const rewardMismatch = result.averageReward >= 900 && result.successRate <= 33;
  if (retainedPrevious) {
    return '<b>今回の更新は見送りました</b><span>固定12環境で成績が下がったため、能力は上書きせず、次の追加学習を歴代ベストから再開します。</span>';
  }

  let title;
  let action;

  if (result.passed) {
    if (environmentDifficulty === 'easy') {
      title = '合格です。次は環境を変えて確かめよう';
      action = '「ほどよい」環境を選んで10秒追加し、回避の汎化を試してください。';
    } else if (environmentDifficulty === 'balanced') {
      title = '複雑な環境でも合格です';
      action = '「むずかしい」環境を選んで10秒追加し、さらに未知の配置へ強くなるか試してください。';
    } else {
      title = '実機候補になる汎化性能です';
      action = '歴代ベストと報酬を比べ、隣の強さへ1項目だけ変えると効果を確認できます。';
    }
  } else if (allStrong) {
    title = '全部「強」でも成功は増えません';
    action = '探索を弱、衝突罰を中へ下げて再学習してください。強い報酬同士の競合を減らせます。';
  } else if (seconds <= 10 && result.successRate >= 25 && rewards.speed <= 35 && rewards.safety === 100 && rewards.goal === 100) {
    title = '複雑な環境で伸びる準備ができています';
    action = '「むずかしい」環境で10秒追加し、回避の経験を増やしてください。';
  } else if (seconds <= 10 && result.successRate >= 25) {
    title = '成功の芽があります';
    action = 'まず同じ環境で10秒追加してください。70/120へ届くか、時間の効果を確認できます。';
  } else if (crashRate >= 50 && rewards.crash === 100) {
    title = '衝突罰が強すぎる可能性があります';
    action = '衝突罰を中へ戻し、探索も強すぎない設定で再学習してください。';
  } else if (crashRate >= 50 && rewards.crash < 70) {
    title = '衝突から学ぶ手掛かりが不足しています';
    action = '衝突罰を1段階上げて再学習してください。';
  } else if (result.successRate <= 17 && rewards.safety < 70) {
    title = 'ゴールへ近づく手掛かりが不足しています';
    action = '接近報酬を中へ上げ、ほかは変えずに再学習してください。';
  } else if (result.successRate <= 17 && rewards.goal < 70) {
    title = '最後まで到達する理由が不足しています';
    action = 'ゴール報酬を中へ上げ、ほかは変えずに再学習してください。';
  } else if (seconds >= 30 && result.successRate <= 25) {
    title = '学習時間より報酬を見直す段階です';
    action = '追加学習を続けず、探索・接近・ゴール・衝突罰のうち1項目だけ変えて比較してください。';
  } else if (result.successRate >= 33 && crashRate >= 42) {
    title = '到達できますが、回避が不安定です';
    action = '「ほどよい」環境で10秒追加するか、衝突罰を1段階変えて回避の変化を比べてください。';
  } else {
    title = '1項目だけ変えて原因を確かめよう';
    action = '接近報酬かゴール報酬を1段階変え、同じ環境で再学習してください。';
  }

  const note = rewardMismatch ? ' AIが集めた点数は高くてもゴールが少ないため、点数の大きさを成功と取り違えないことが大切です。' : '';
  return `<b>次の一手：${title}</b><span>${action}${note}</span>`;
}

function renderEvaluationComparison(current, previousBest, isNewBest, acceptedInRun) {
  const comparison = previousBest || current;
  $('#evaluationPanel').classList.remove('hidden');
  $('#currentEvaluation').innerHTML = evaluationMarkup(current, isNewBest);
  $('#evaluationAdvice').innerHTML = evaluationAdvice(current, !acceptedInRun);
  const stages = { 0: '無', 35: '弱', 70: '中', 100: '強' };
  $('#bestEvaluation').innerHTML = evaluationMarkup(comparison, !isNewBest && comparison === historicalBest);
  const rewardNames = { speed: '探索幅', safety: '接近報酬', goal: 'ゴール報酬', crash: '衝突罰' };
  const lesson = rewardLesson(current.evaluation, previousBest?.evaluation || null);
  $('#rewardLesson').className = `reward-lesson ${lesson.type}`;
  $('#rewardLesson').innerHTML = `<b>${lesson.title}</b><span>${lesson.body}</span>`;
  if (!previousBest) {
    $('#rewardImpact').textContent = 'この結果を基準にしました。報酬を1項目だけ変え、AIの点数と本番のゴールがどう変わるか比べてみましょう。';
    return;
  }
  const key = Object.keys(rewardNames).sort((a, b) =>
    Math.abs(current.rewards[b] - previousBest.rewards[b]) - Math.abs(current.rewards[a] - previousBest.rewards[a])
  )[0];
  const successDelta = current.evaluation.successes - previousBest.evaluation.successes;
  const crashDelta = current.evaluation.crashes - previousBest.evaluation.crashes;
  const rewardDelta = current.evaluation.averageReward - previousBest.evaluation.averageReward;
  if (current.environmentId && previousBest.environmentId && current.environmentId !== previousBest.environmentId) {
    $('#rewardImpact').textContent =
      `学習環境：${previousBest.environmentId} → ${current.environmentId}。AIの点数 ${signed(rewardDelta)}、本番のゴール ${signed(successDelta)}、衝突 ${signed(crashDelta)}。環境の難しさと配置が学習へ与えた影響です。`;
    return;
  }
  $('#rewardImpact').textContent =
    `${rewardNames[key]}：${stages[previousBest.rewards[key]]} → ${stages[current.rewards[key]]}。AIの点数 ${signed(rewardDelta)}、本番のゴール ${signed(successDelta)}、衝突 ${signed(crashDelta)}。`;
}

function finishTrainingEnvironment() {
  accumulatedTrainingSeconds += realDuration;
  trainingCandidate = candidateFromTraining();
  trainingHistory.push({
    environment: currentLayout,
    environmentId: S.environmentId,
    successRate: realTrainer.successRate(),
    crashes: realTrainer.crashes,
    rewards: { speed: S.speed, safety: S.safety, goal: S.goal, crash: S.crash }
  });
  window.trainedPolicy = null;
  $('#transfer').classList.add('hidden');
  $('#exam').classList.add('hidden');
  $('#continueTrain').classList.add('hidden');
  $('#trainingState').textContent = trainingCandidate ? '12環境を評価中' : '学習完了';
  if (trainingCandidate) {
    toast('訓練終了 — 未学習の12環境で自動評価します');
    startCandidateEvaluation();
  } else {
    $('#continueTrain').classList.remove('hidden');
    toast('評価できる方策がありません。報酬を見直すか追加学習してください');
  }
}

function completeNoRewardObservation() {
  cancelAnimationFrame(S.raf);
  baselineObservation = false;
  S.paused = true;
  const success = realTrainer.successRate();
  $('#trainingState').textContent = '確認完了';
  $('#baselineResult').innerHTML = `<b>報酬なしの結果：成功率 ${success}%</b><span>良い行動を比べる点数がないため、ゴールできる割合はほとんど増えませんでした。</span>`;
  $('#baselineResult').classList.remove('hidden');
  $('#baselineContinue').classList.remove('hidden');
  toast('報酬がないと、AIは成功した動きを選んで残せません');
}

function startNoRewardObservation() {
  for (const key of ['speed', 'safety', 'goal', 'crash']) $(`#${key}`).value = 0;
  rewards();
  document.body.classList.add('baseline-focus', 'training-focus');
  $$('.panel').forEach(panel => panel.classList.toggle('active', +panel.dataset.panel === 2));
  $$('.step').forEach(step => step.classList.toggle('active', +step.dataset.step === 0));
  startRealTraining();
  baselineObservation = true;
  realDuration = 8;
  $('#trainingEyebrow').textContent = 'STEP 00 — NO REWARD OBSERVATION';
  $('#trainingTitle').textContent = '報酬なしで動きを確認中';
  $('#trainingDescription').textContent = 'どの行動も同じ0点。動いても、良い動きを選んで残せません。';
  $('#trainingState').textContent = '報酬なしを観察中';
  $('#baselineResult').classList.add('hidden');
  $('#baselineContinue').classList.add('hidden');
  scrollTo({ top: 0, behavior: 'smooth' });
}

function finishNoRewardObservation() {
  document.body.classList.remove('baseline-focus', 'training-focus');
  S.step = 1;
  $$('.panel').forEach(panel => panel.classList.toggle('active', +panel.dataset.panel === 1));
  $$('.step').forEach(step => step.classList.toggle('active', +step.dataset.step === 1));
  $('#trainingEyebrow').textContent = 'STEP 02 — HIGH SPEED TRAINING';
  $('#trainingTitle').textContent = 'AIが試行錯誤しています';
  $('#trainingDescription').textContent = '失敗するたびに、少しずつ上手くなる。';
  $('#baselineResult').classList.add('hidden');
  $('#baselineContinue').classList.add('hidden');
  rewards();
  scrollTo({ top: 0, behavior: 'smooth' });
  toast('次は、行動を選ぶ手掛かりとなる報酬を設計しましょう');
}

function skipNoRewardTutorial() {
  if (!confirm('運営・動作確認用の操作です。\n報酬なしの観察をスキップして、報酬設計へ進みますか？')) return;
  cancelAnimationFrame(S.raf);
  baselineObservation = false;
  S.paused = true;
  finishNoRewardObservation();
  toast('チュートリアルをスキップしました');
}

window.startNoRewardObservation = startNoRewardObservation;
window.finishNoRewardObservation = finishNoRewardObservation;
window.skipNoRewardTutorial = skipNoRewardTutorial;

function realFrame(now) {
  const dt = Math.min(0.05, (now - realLast) / 1000);
  realLast = now;
  if (!S.paused) {
    const activeDelta = Math.min(dt, realDuration - S.elapsed);
    S.elapsed += activeDelta;
    trainingStepBudget += activeDelta * activeTrainingStepsPerSecond;
    const targetSteps = Math.round(realDuration * activeTrainingStepsPerSecond);
    const remainingSteps = Math.max(0, targetSteps - trainingRunSteps);
    const trainingSteps = S.elapsed >= realDuration
      ? remainingSteps
      : Math.min(remainingSteps, Math.floor(trainingStepBudget));
    if (trainingSteps > 0) {
      realTrainer.step(trainingSteps);
      trainingStepBudget -= trainingSteps;
      trainingRunSteps += trainingSteps;
    }
  }
  drawTrainingWorld();
  updateRealMetrics();
  if (S.elapsed >= realDuration) {
    if (baselineObservation) completeNoRewardObservation();
    else finishTrainingEnvironment();
    return;
  }
  S.raf = requestAnimationFrame(realFrame);
}

function startRealTraining() {
  document.body.classList.remove('evaluation-focus');
  accumulatedTrainingSeconds = 0;
  currentRunBest = null;
  trainingHistory.length = 0;
  baselineObservation = false;
  $('#baselineResult').classList.add('hidden');
  $('#baselineContinue').classList.add('hidden');
  cancelAnimationFrame(S.raf);
  window.trainedPolicy = null;
  trainingCandidate = null;
  S.environmentIndex = 0;
  prepareTrainingEnvironment();
  S.elapsed = 0;
  realDuration = 10;
  $('#trainingState').textContent = '学習中';
  S.paused = false;
  $('#pause').textContent = 'Ⅱ';
  $('#transfer').classList.add('hidden');
  $('#exam').classList.add('hidden');
  $('#continueTrain').classList.add('hidden');
  realTrainer.reset(obs, { speed: S.speed, safety: S.safety, goal: S.goal, crash: S.crash }, S.difficulty);
  trainingStepBudget = 0;
  trainingRunSteps = 0;
  activeTrainingStepsPerSecond = TRAINING_STEPS_PER_SECOND.initial;
  realLast = performance.now();
  S.raf = requestAnimationFrame(realFrame);
}

function resetAllTraining() {
  historicalBest = null;
  trainingHistory.length = 0;
  $('#evaluationPanel').classList.add('hidden');
  startRealTraining();
}

startTraining = startRealTraining;
$('#retry').onclick = resetAllTraining;

function continueRealTraining() {
  document.body.classList.remove('evaluation-focus');
  cancelAnimationFrame(S.raf);
  window.trainedPolicy = null;
  const latestCandidate = trainingCandidate;
  const validatedChampion = currentRunBest || latestCandidate;
  trainingCandidate = null;
  prepareTrainingEnvironment();
  realTrainer.continueEnvironment(obs, S.difficulty, validatedChampion);
  S.elapsed = 0;
  realDuration = 10;
  S.paused = false;
  $('#pause').textContent = 'Ⅱ';
  $('#trainingState').textContent = '学習中';
  $('#continueTrain').classList.add('hidden');
  $('#exam').classList.add('hidden');
  $('#transfer').classList.add('hidden');
  trainingStepBudget = 0;
  trainingRunSteps = 0;
  activeTrainingStepsPerSecond = TRAINING_STEPS_PER_SECOND.additional;
  realLast = performance.now();
  toast(`個体群を保持して${currentLayout}で追加学習`);
  S.raf = requestAnimationFrame(realFrame);
}

function updateExamMetrics() {
  const alive = realTrainer.agents.filter(agent => agent.alive).length;
  const successes = realTrainer.agents.filter(agent => agent.reached).length;
  const crashes = realTrainer.agents.filter(agent => agent.crashed).length;
  const progress = Math.min(1, realTrainer.steps / 300);
  $('#count').textContent = ((300 - realTrainer.steps) / EVALUATION_STEPS_PER_SECOND).toFixed(1);
  $('#success').textContent = `${successes} / 120`;
  $('#crashes').textContent = String(crashes);
  $('#ring').style.background = `conic-gradient(var(--cyan) ${progress * 100}%,#1b3243 0)`;
  $('#log').textContent = `12環境×10角度を評価中：成功 ${successes} ／ 走行中 ${alive}`;
  $('#intelStage').textContent = '報酬を固定して汎化性能を測定';
}

function finishCandidateEvaluation() {
  const result = realTrainer.evaluationResult();
  const current = { ...trainingCandidate, evaluation: result };
  const acceptedInRun = !currentRunBest
    || (result.passed && !currentRunBest.evaluation.passed)
    || (result.passed === currentRunBest.evaluation.passed
      && result.deploymentScore > currentRunBest.evaluation.deploymentScore);
  if (acceptedInRun) currentRunBest = current;

  const previousBest = historicalBest;
  const isNewBest = !historicalBest
    || (result.passed && !historicalBest.evaluation.passed)
    || (result.passed === historicalBest.evaluation.passed && result.deploymentScore > historicalBest.evaluation.deploymentScore);
  if (isNewBest) historicalBest = current;
  recordExperiment(current, acceptedInRun);
  renderEvaluationComparison(current, previousBest, isNewBest, acceptedInRun);
  document.body.classList.add('evaluation-focus');
  $('#evaluationPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#success').textContent = `${result.successes} / 120`;
  $('#crashes').textContent = String(result.crashes);
  $('#trainingState').textContent = '12環境の評価完了';
  $('#continueTrain').classList.remove('hidden');

  if (historicalBest && historicalBest.evaluation.passed) {
    window.trainedPolicy = {
      weights: [...historicalBest.weights],
      fitness: historicalBest.fitness,
      successful: true,
      examPassed: true,
      evaluation: historicalBest.evaluation,
      rewards: historicalBest.rewards,
      difficulty: historicalBest.difficulty,
      evaluations: historicalBest.evaluations
    };
    $('#btype').textContent = `BEST MODEL · ${historicalBest.evaluation.successRate}%`;
    $('#transfer').classList.remove('hidden');
    S.step = 3;
  } else {
    window.trainedPolicy = null;
    $('#transfer').classList.add('hidden');
  }
  $('#log').textContent = `120試行：成功 ${result.successes}・衝突 ${result.crashes}・実機適性 ${Math.round(result.deploymentScore)}`;
  toast(isNewBest ? '歴代ベストを更新しました' : '評価完了。実機には歴代ベストを転送します');
}

function examFrame(now) {
  const dt = Math.min(0.05, (now - evaluationLast) / 1000);
  evaluationLast = now;
  if (!S.paused) {
    evaluationStepBudget += dt * EVALUATION_STEPS_PER_SECOND;
    const evaluationSteps = Math.floor(evaluationStepBudget);
    if (evaluationSteps > 0) {
      realTrainer.stepEvaluation(evaluationSteps);
      evaluationStepBudget -= evaluationSteps;
    }
  }
  drawTrainingWorld();
  updateExamMetrics();
  if (realTrainer.steps >= 300 || realTrainer.agents.every(agent => !agent.alive)) {
    finishCandidateEvaluation();
    return;
  }
  S.raf = requestAnimationFrame(examFrame);
}

function startCandidateEvaluation() {
  cancelAnimationFrame(S.raf);
  window.trainedPolicy = null;
  const suite = prepareEvaluationSuite();
  realTrainer.startEvaluation(trainingCandidate, suite);
  S.paused = false;
  $('#trainingState').textContent = '評価中（学習なし）';
  $('#pause').textContent = 'Ⅱ';
  $('#continueTrain').classList.add('hidden');
  $('#exam').classList.add('hidden');
  $('#transfer').classList.add('hidden');
  evaluationStepBudget = 0;
  evaluationLast = performance.now();
  S.raf = requestAnimationFrame(examFrame);
}

$('#continueTrain').onclick = continueRealTraining;
$('#exam').onclick = startCandidateEvaluation;

$("#backDesign").onclick = () => {
  document.body.classList.remove('evaluation-focus');
  cancelAnimationFrame(S.raf);
  go(1);
};

window.realTrainer = realTrainer;
