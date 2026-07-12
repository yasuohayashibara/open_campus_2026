/* Connects the real evolutionary trainer to the existing workshop UI. */
const realTrainer = new RealTrainer();
let realLast = 0;

function drawRealNetwork(brain) {
  const canvas = $('#network');
  if (!canvas || !brain) return;
  const g = canvas.getContext('2d');
  const layers = [5, 8, 2];
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
  g.font = '6px Inter,sans-serif';
  g.textAlign = 'center';
  g.fillText('STATE ×5', 22, 121);
  g.fillText('HIDDEN ×8', 115, 121);
  g.fillText('MOTOR ×2', 208, 121);
}

function drawTrainingWorld() {
  grid();
  ctx.beginPath();
  ctx.arc(realTrainer.goal.x, realTrainer.goal.y, 35, 0, Math.PI * 2);
  ctx.fillStyle = '#8465ff33';
  ctx.fill();
  ctx.strokeStyle = '#8d70ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#c7bbff';
  ctx.font = 'bold 12px Inter,sans-serif';
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
    const matX = Math.round(45 + obstacle.x / 900 * 410);
    const matY = Math.round(45 + obstacle.y / 520 * 410);
    ctx.fillStyle = '#ffb17f';
    ctx.font = '9px Inter,sans-serif';
    ctx.fillText(`O${index + 1}`, obstacle.x, obstacle.y + 3);
    ctx.fillStyle = '#9aabbb';
    ctx.font = '7px Inter,sans-serif';
    ctx.fillText(`(${matX}, ${matY})`, obstacle.x, obstacle.y + obstacle.r + 13);
  });

  const best = realTrainer.bestAgent();
  for (const agent of realTrainer.agents) {
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

  if (best) {
    const features = realTrainer.inputs(best);
    const motors = realTrainer.infer(best.brain, features);
    ctx.fillStyle = '#07141fdd';
    ctx.fillRect(42, 35, 260, 96);
    ctx.strokeStyle = '#29485a';
    ctx.strokeRect(42, 35, 260, 96);
    ctx.fillStyle = '#6f899b';
    ctx.font = '8px Inter,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`GENERATION ${realTrainer.generation} · 24 ROBOTS`, 57, 53);
    ctx.fillStyle = '#e9f8ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(best.reached ? 'ゴール方策を発見！' : '実報酬から重みを更新中…', 57, 74);
    ctx.font = '8px Inter,sans-serif';
    ctx.fillStyle = '#8465ff';
    ctx.fillText(`GOAL DIST ${features[0].toFixed(2)}`, 57, 94);
    ctx.fillStyle = '#ff8b48';
    ctx.fillText(`OBSTACLE ${features[3].toFixed(2)}`, 155, 94);
    ctx.fillStyle = '#18d9dc';
    ctx.fillText(`MOTOR L ${motors[0].toFixed(2)}`, 57, 113);
    ctx.fillStyle = '#49f2a5';
    ctx.fillText(`MOTOR R ${motors[1].toFixed(2)}`, 155, 113);
  }
  drawRealNetwork(realTrainer.bestEver || (best && best.brain));
}

function updateRealMetrics() {
  const elapsedRatio = Math.min(1, S.elapsed / 15);
  const success = realTrainer.successRate();
  const intelligence = Math.min(1, realTrainer.generation / 70 * 0.55 + success / 100 * 0.45);
  const level = Math.min(5, Math.floor(intelligence * 6));
  const stages = ['重みをランダム生成', '報酬を比較中', '接近行動を獲得', '衝突回避を獲得', '経路を最適化', '方策が完成！'];
  $('#count').textContent = Math.max(0, 15 - S.elapsed).toFixed(1);
  $('#trials').textContent = realTrainer.evaluations.toLocaleString();
  $('#success').textContent = `${success}%`;
  $('#crashes').textContent = realTrainer.crashes.toLocaleString();
  $('#ring').style.background = `conic-gradient(var(--cyan) ${elapsedRatio * 100}%,#1b3243 0)`;
  $('#reward').textContent = realTrainer.bestEver ? Math.round(realTrainer.bestEver.fitness) : '0';
  $('#log').textContent = `世代 ${realTrainer.generation}：上位4個体を選択し重みを突然変異`;
  $('#intelLevel').textContent = level;
  $('#intelBar').style.width = `${intelligence * 100}%`;
  $('#intelStage').textContent = stages[level];
  $('#dangerCount').textContent = Math.min(4, Math.floor(realTrainer.generation / 4));
  $('#ruleCount').textContent = Math.min(12, Math.floor(intelligence * 12));
  chart(intelligence);
}

function realFrame(now) {
  const dt = Math.min(0.05, (now - realLast) / 1000);
  realLast = now;
  if (!S.paused) {
    S.elapsed = Math.min(15, S.elapsed + dt);
    realTrainer.step(24);
  }
  drawTrainingWorld();
  updateRealMetrics();
  if (S.elapsed >= 15) {
    window.trainedPolicy = realTrainer.bestEver;
    $('#transfer').classList.remove('hidden');
    S.step = 3;
    toast(`実学習完了：${realTrainer.evaluations.toLocaleString()}個体を評価`);
    return;
  }
  S.raf = requestAnimationFrame(realFrame);
}

function startRealTraining() {
  cancelAnimationFrame(S.raf);
  S.elapsed = 0;
  S.paused = false;
  $('#pause').textContent = 'Ⅱ';
  $('#transfer').classList.add('hidden');
  realTrainer.reset(obs, { speed: S.speed, safety: S.safety, goal: S.goal, crash: S.crash });
  realLast = performance.now();
  S.raf = requestAnimationFrame(realFrame);
}

startTraining = startRealTraining;
$('#retry').onclick = startRealTraining;
window.realTrainer = realTrainer;
