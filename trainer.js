/* Real, dependency-free evolutionary reinforcement learning engine. */
class RealTrainer {
  constructor() {
    this.inputSize = 5;
    this.hiddenSize = 8;
    this.outputSize = 2;
    this.weightCount = 56;
    this.parameterCount = 66;
    this.populationSize = 96;
    this.goal = { x: 825, y: 90 };
    this.seed = 2026;
    this.generation = 0;
    this.evaluations = 0;
    this.successes = [];
    this.crashes = 0;
    this.bestEver = null;
    this.reset([], { speed: 60, safety: 75, goal: 80, crash: 70 });
  }

  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  gaussian() {
    const a = Math.max(1e-8, this.random());
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * this.random());
  }

  makeBrain(parent = null, sigma = 0.3) {
    const n = this.parameterCount;
    const weights = parent
      ? parent.weights.map(value => value + this.gaussian() * sigma)
      : Array.from({ length: n }, () => this.gaussian() * (0.18 + this.rewards.speed / 145));
    return { weights, fitness: 0 };
  }

  reset(obstacles, rewards) {
    this.obstacles = obstacles;
    this.rewards = rewards;
    this.seed = 2026;
    this.generation = 0;
    this.evaluations = 0;
    this.successes = [];
    this.crashes = 0;
    this.bestEver = null;
    this.population = Array.from({ length: this.populationSize }, () => this.makeBrain());
    this.startGeneration();
  }

  startGeneration() {
    this.steps = 0;
    this.agents = this.population.map((brain, index) => ({
      brain, index, x: 65, y: 390, angle: -0.35 + (this.random() - 0.5) * 0.8,
      reward: 0, alive: true, reached: false, path: [{ x: 65, y: 390 }],
      leftSpeed: 0, rightSpeed: 0, forward: 0, turnGrip: 1, brakingDistance: 0,
      previousDistance: Math.hypot(this.goal.x - 65, this.goal.y - 390)
    }));
  }

  inputs(agent) {
    const dx = this.goal.x - agent.x;
    const dy = this.goal.y - agent.y;
    const distance = Math.hypot(dx, dy);
    const goalAngle = Math.atan2(dy, dx);
    const relativeGoal = this.wrap(goalAngle - agent.angle);
    let nearestDistance = 300;
    let nearestAngle = 0;
    for (const obstacle of this.obstacles) {
      const ox = obstacle.x - agent.x;
      const oy = obstacle.y - agent.y;
      const d = Math.max(0, Math.hypot(ox, oy) - obstacle.r - 10);
      const relative = this.wrap(Math.atan2(oy, ox) - agent.angle);
      if (Math.abs(this.wrap(relative - relativeGoal)) < 1.15 && d < nearestDistance) {
        nearestDistance = d;
        nearestAngle = relative;
      }
    }
    return [
      Math.min(1, distance / 850),
      Math.sin(relativeGoal),
      Math.cos(relativeGoal),
      Math.min(1, nearestDistance / 300),
      Math.sin(nearestAngle)
    ];
  }

  infer(brain, inputs) {
    const w = brain.weights;
    const hidden = new Array(this.hiddenSize);
    let cursor = 0;
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = 0;
      for (let i = 0; i < this.inputSize; i++) sum += inputs[i] * w[cursor++];
      hidden[h] = Math.tanh(sum + w[56 + h]);
    }
    const output = [0, 0];
    for (let o = 0; o < this.outputSize; o++) {
      let sum = 0;
      for (let h = 0; h < this.hiddenSize; h++) sum += hidden[h] * w[cursor++];
      output[o] = Math.tanh(sum + w[64 + o]);
    }
    return output;
  }

  stepAgent(agent, dt) {
    if (!agent.alive) return;
    const [leftRaw, rightRaw] = this.infer(agent.brain, this.inputs(agent));
    const speedScale = 135;
    const targetLeft = leftRaw * speedScale;
    const targetRight = rightRaw * speedScale;
    const acceleration = 4.2;
    agent.leftSpeed += Math.max(-acceleration, Math.min(acceleration, targetLeft - agent.leftSpeed));
    agent.rightSpeed += Math.max(-acceleration, Math.min(acceleration, targetRight - agent.rightSpeed));
    const left = agent.leftSpeed;
    const right = agent.rightSpeed;
    const forward = (left + right) * 0.5;
    const turnGrip = Math.max(0.24, 1 - Math.abs(forward) / 205);
    agent.forward = forward;
    agent.turnGrip = turnGrip;
    agent.brakingDistance = forward * forward / 480;
    agent.angle += (left - right) * 0.014 * turnGrip * dt;
    agent.x += Math.cos(agent.angle) * forward * dt;
    agent.y += Math.sin(agent.angle) * forward * dt;

    const distance = Math.hypot(this.goal.x - agent.x, this.goal.y - agent.y);
    const progress = agent.previousDistance - distance;
    agent.reward += progress * (0.18 + this.rewards.safety / 32);
    agent.reward += Math.sqrt(Math.max(0, forward)) * dt * 0.12;
    agent.reward -= (left * left + right * right) * dt * 0.000022;
    agent.reward -= Math.abs(right - left) * Math.abs(forward) * dt * 0.00012;
    agent.previousDistance = distance;

    let nearest = Infinity;
    for (const obstacle of this.obstacles) {
      const d = Math.hypot(agent.x - obstacle.x, agent.y - obstacle.y) - obstacle.r - 10;
      nearest = Math.min(nearest, d);
      if (d <= 0) {
        agent.reward -= 30 + this.rewards.crash * 1.4;
        agent.alive = false;
        agent.crashed = true;
      }
    }
    const effectiveClearance = nearest - agent.brakingDistance;
    if (effectiveClearance < 80) {
      agent.reward -= (80 - effectiveClearance) * dt * this.rewards.crash / 180;
    }
    if (distance < 30) {
      agent.reward += 100 + this.rewards.goal * 2 + (300 - this.steps) * 0.32;
      agent.alive = false;
      agent.reached = true;
    }
    if (agent.x < 35 || agent.x > 865 || agent.y < 30 || agent.y > 490) {
      agent.reward -= 45;
      agent.alive = false;
    }
    if (this.steps % 5 === 0 && agent.path.length < 80) agent.path.push({ x: agent.x, y: agent.y });
  }

  step(iterations = 8) {
    for (let iteration = 0; iteration < iterations; iteration++) {
      this.steps++;
      for (const agent of this.agents) this.stepAgent(agent, 1 / 30);
      if (this.steps >= 300 || this.agents.every(agent => !agent.alive)) this.evolve();
    }
  }

  evolve() {
    for (const agent of this.agents) {
      if (agent.alive) agent.reward -= agent.previousDistance * 0.03;
      agent.brain.fitness = agent.reward;
      this.successes.push(agent.reached ? 1 : 0);
      if (agent.crashed) this.crashes++;
    }
    if (this.successes.length > 100) this.successes.splice(0, this.successes.length - 100);
    this.evaluations += this.populationSize;
    this.population.sort((a, b) => b.fitness - a.fitness);
    if (!this.bestEver || this.population[0].fitness > this.bestEver.fitness) {
      this.bestEver = { weights: [...this.population[0].weights], fitness: this.population[0].fitness };
    }
    const elites = this.population.slice(0, 8);
    const exploration = 0.18 + this.rewards.speed / 82;
    const sigma = Math.max(0.025, exploration * Math.pow(0.982, this.generation));
    const next = elites.map(elite => ({ weights: [...elite.weights], fitness: 0 }));
    while (next.length < this.populationSize) {
      next.push(this.makeBrain(elites[Math.floor(this.random() * elites.length)], sigma));
    }
    this.population = next;
    this.generation++;
    this.startGeneration();
  }

  successRate() {
    if (!this.successes.length) return 0;
    return Math.round(this.successes.reduce((a, b) => a + b, 0) / this.successes.length * 100);
  }

  bestAgent() {
    return this.agents.reduce((best, agent) => agent.reward > best.reward ? agent : best, this.agents[0]);
  }

  wrap(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
}

window.RealTrainer = RealTrainer;
