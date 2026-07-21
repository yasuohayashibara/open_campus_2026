/* Connects the real evolutionary trainer to the existing workshop UI. */
const realTrainer = new RealTrainer();
let realLast = 0;
let realDuration = 15;

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

  realTrainer.agents.forEach((agent, index) => {
    const row = Math.floor(index / columns);
    let column = index % columns;
    const cellX = column * cellWidth;
    const cellY = row * cellHeight;
    const fieldWidth = sim.width * scale;
    const fieldHeight = sim.height * scale;
    const offsetX = cellX + (cellWidth - fieldWidth) / 2;
    const offsetY = cellY + 27;
    const state = evaluationStatus(agent);

    ctx.fillStyle = '#07141fee';
    ctx.fillRect(cellX + 5, cellY + 5, cellWidth - 10, cellHeight - 10);
    ctx.strokeStyle = state.color;
    ctx.lineWidth = agent.alive ? 1 : 2;
    ctx.strokeRect(cellX + 5, cellY + 5, cellWidth - 10, cellHeight - 10);

    ctx.fillStyle = '#d7e8f2';
    ctx.font = 'bold 11px Inter,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`E${String(index + 1).padStart(2, '0')}`, cellX + 12, cellY + 20);
    ctx.fillStyle = state.color;
    ctx.textAlign = 'center';
    ctx.fillText(state.label, cellX + cellWidth / 2, cellY + 20);
    ctx.fillStyle = '#7890a2';
    ctx.textAlign = 'right';
    ctx.fillText(`R ${signed(agent.reward)}`, cellX + cellWidth - 12, cellY + 20);

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

    const obstacles = agent.obstacles || [];
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

    if (agent.path.length > 1) {
      ctx.beginPath();
      agent.path.forEach((point, pointIndex) => ctx[pointIndex ? 'lineTo' : 'moveTo'](point.x, point.y));
      ctx.strokeStyle = state.color;
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(agent.x, agent.y);
    ctx.rotate(agent.angle);
    ctx.fillStyle = state.color;
    ctx.fillRect(-10, -7, 20, 14);
    ctx.fillStyle = '#06111c';
    ctx.fillRect(1, -3, 8, 6);
    ctx.restore();
    ctx.restore();
  });

  ctx.fillStyle = '#71899b';
  ctx.font = '10px Inter,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('12 ENVIRONMENTS · SAME POLICY · NO LEARNING', sim.width / 2, sim.height - 7);
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
let historicalBest = null;

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
    generation: realTrainer.generation
  };
}

function signed(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
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
  const rows = groupedBreakdown(result).map(([label, value]) => {
    const width = Math.min(100, Math.abs(value) / 3.5);
    return `<div class="reward-row"><span>${label}</span><i class="${value >= 0 ? 'positive' : 'negative'}" style="--value:${width}%"></i><b>${signed(value)}</b></div>`;
  }).join('');
  return `
    <div class="evaluation-score"><b>${result.successes}<small>/12 GOAL</small></b><strong>${Math.round(result.deploymentScore)}<small>実機適性</small></strong></div>
    <div class="evaluation-stats"><span>衝突 <b>${result.crashes}/12</b></span><span>平均 <b>${result.averageTime.toFixed(1)}秒</b></span><span>安全距離 <b>${Math.round(result.averageClearance)}</b></span></div>
    <div class="reward-settings"><span>探索 ${settings.speed}</span><span>接近 ${settings.safety}</span><span>ゴール ${settings.goal}</span><span>衝突罰 ${settings.crash}</span></div>
    <div class="reward-breakdown"><small>12環境の平均報酬内訳</small>${rows}<div class="reward-total"><span>評価報酬</span><b>${signed(result.averageReward)}</b></div></div>
    ${isChampion ? '<em class="champion-badge">実機へ転送するモデル</em>' : ''}`;
}

function renderEvaluationComparison(current, previousBest, isNewBest) {
  const comparison = previousBest || current;
  $('#evaluationPanel').classList.remove('hidden');
  $('#currentEvaluation').innerHTML = evaluationMarkup(current, isNewBest);
  $('#bestEvaluation').innerHTML = evaluationMarkup(comparison, !isNewBest && comparison === historicalBest);
  const rewardNames = { speed: '探索幅', safety: '接近報酬', goal: 'ゴール報酬', crash: '衝突罰' };
  if (!previousBest) {
    $('#rewardImpact').textContent = '初回評価を基準記録にしました。報酬を変えて再学習すると、設定差と結果差をここで比較できます。';
    return;
  }
  const key = Object.keys(rewardNames).sort((a, b) =>
    Math.abs(current.rewards[b] - previousBest.rewards[b]) - Math.abs(current.rewards[a] - previousBest.rewards[a])
  )[0];
  const settingDelta = current.rewards[key] - previousBest.rewards[key];
  const successDelta = current.evaluation.successes - previousBest.evaluation.successes;
  const crashDelta = current.evaluation.crashes - previousBest.evaluation.crashes;
  $('#rewardImpact').textContent =
    `${rewardNames[key]} ${settingDelta >= 0 ? '+' : ''}${settingDelta}。同じ12環境で、成功 ${successDelta >= 0 ? '+' : ''}${successDelta}、衝突 ${crashDelta >= 0 ? '+' : ''}${crashDelta}。報酬差と行動結果を比較してください。`;
}

function finishTrainingEnvironment() {
  trainingCandidate = candidateFromTraining();
  trainingHistory.push({
    environment: currentLayout,
    complexity: S.complexity,
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

function realFrame(now) {
  const dt = Math.min(0.05, (now - realLast) / 1000);
  realLast = now;
  if (!S.paused) {
    S.elapsed = Math.min(realDuration, S.elapsed + dt);
    realTrainer.step(6);
  }
  drawTrainingWorld();
  updateRealMetrics();
  if (S.elapsed >= realDuration) {
    finishTrainingEnvironment();
    return;
  }
  S.raf = requestAnimationFrame(realFrame);
}

function startRealTraining() {
  document.body.classList.remove('evaluation-focus');
  cancelAnimationFrame(S.raf);
  window.trainedPolicy = null;
  trainingCandidate = null;
  S.environmentIndex = 0;
  prepareTrainingEnvironment();
  S.elapsed = 0;
  realDuration = 15;
  $('#trainingState').textContent = '学習中';
  S.paused = false;
  $('#pause').textContent = 'Ⅱ';
  $('#transfer').classList.add('hidden');
  $('#exam').classList.add('hidden');
  $('#continueTrain').classList.add('hidden');
  realTrainer.reset(obs, { speed: S.speed, safety: S.safety, goal: S.goal, crash: S.crash }, S.difficulty);
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
  trainingCandidate = null;
  prepareTrainingEnvironment();
  realTrainer.continueEnvironment(obs, S.difficulty);
  S.elapsed = 0;
  realDuration = 10;
  S.paused = false;
  $('#pause').textContent = 'Ⅱ';
  $('#trainingState').textContent = '学習中';
  $('#continueTrain').classList.add('hidden');
  $('#exam').classList.add('hidden');
  $('#transfer').classList.add('hidden');
  realLast = performance.now();
  toast(`個体群を保持して${currentLayout}で追加学習`);
  S.raf = requestAnimationFrame(realFrame);
}

function updateExamMetrics() {
  const alive = realTrainer.agents.filter(agent => agent.alive).length;
  const successes = realTrainer.agents.filter(agent => agent.reached).length;
  const crashes = realTrainer.agents.filter(agent => agent.crashed).length;
  const progress = Math.min(1, realTrainer.steps / 300);
  $('#count').textContent = ((300 - realTrainer.steps) / 30).toFixed(1);
  $('#success').textContent = `${successes} / 10`;
  $('#crashes').textContent = String(crashes);
  $('#ring').style.background = `conic-gradient(var(--cyan) ${progress * 100}%,#1b3243 0)`;
  $('#log').textContent = `固定12環境を評価中：成功 ${successes} ／ 走行中 ${alive}`;
  $('#intelStage').textContent = '報酬を固定して汎化性能を測定';
}

function finishCandidateEvaluation() {
  const result = realTrainer.evaluationResult();
  const current = { ...trainingCandidate, evaluation: result };
  const previousBest = historicalBest;
  const isNewBest = !historicalBest
    || (result.passed && !historicalBest.evaluation.passed)
    || (result.passed === historicalBest.evaluation.passed && result.deploymentScore > historicalBest.evaluation.deploymentScore);
  if (isNewBest) historicalBest = current;
  renderEvaluationComparison(current, previousBest, isNewBest);
  document.body.classList.add('evaluation-focus');
  $('#evaluationPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#success').textContent = `${result.successes} / 10`;
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
      difficulty: historicalBest.difficulty
    };
    $('#btype').textContent = `BEST MODEL · ${historicalBest.evaluation.successes}/12`;
    $('#transfer').classList.remove('hidden');
    S.step = 3;
  } else {
    window.trainedPolicy = null;
    $('#transfer').classList.add('hidden');
  }
  $('#log').textContent = `12環境：成功 ${result.successes}・衝突 ${result.crashes}・実機適性 ${Math.round(result.deploymentScore)}`;
  toast(isNewBest ? '歴代ベストを更新しました' : '評価完了。実機には歴代ベストを転送します');
}

function examFrame() {
  if (!S.paused) realTrainer.stepEvaluation(1);
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
