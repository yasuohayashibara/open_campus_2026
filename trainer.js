/* Real, dependency-free evolutionary reinforcement learning engine. */
class RealTrainer {
  constructor() {
    this.inputSize = 7;
    this.hiddenSize = 8;
    this.outputSize = 2;
    this.weightCount = this.inputSize * this.hiddenSize + this.hiddenSize * this.outputSize;
    this.parameterCount = this.weightCount + this.hiddenSize + this.outputSize;
    this.populationSize = 96;
    this.goal = { x: 825, y: 90 };
    this.goalRadius = 45;
    this.seed = 2026;
    this.generation = 0;
    this.evaluations = 0;
    this.successes = [];
    this.crashes = 0;
    this.bestEver = null;
    this.bestSuccessful = null;
    this.start = { x: 130, y: 366, angle: -0.38 };
    this.difficultyProfiles = {
      easy: { acceleration: 240, braking: 300, angularAcceleration: 12, lateralAcceleration: 150 },
      standard: { acceleration: 126, braking: 170, angularAcceleration: 7, lateralAcceleration: 90 },
      challenge: { acceleration: 70, braking: 95, angularAcceleration: 3.5, lateralAcceleration: 55 }
    };
    this.difficulty = 'standard';
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
      : Array.from({ length: n }, () => this.gaussian() * (0.05 + this.rewards.speed / 120));
    return { weights, fitness: 0 };
  }

  reset(obstacles, rewards, difficulty = 'standard') {
    this.obstacles = obstacles;
    this.rewards = rewards;
    this.difficulty = this.difficultyProfiles[difficulty] ? difficulty : 'standard';
    this.seed = 2026;
    this.generation = 0;
    this.evaluations = 0;
    this.successes = [];
    this.crashes = 0;
    this.bestEver = null;
    this.bestSuccessful = null;
    this.protectedBrain = null;
    this.population = Array.from({ length: this.populationSize }, () => this.makeBrain());
    this.startGeneration();
  }

  continueEnvironment(obstacles, difficulty = this.difficulty, validatedChampion = null) {
    this.obstacles = obstacles;
    this.difficulty = this.difficultyProfiles[difficulty] ? difficulty : 'standard';
    if (validatedChampion?.weights?.length === this.parameterCount) {
      this.protectedBrain = { weights: [...validatedChampion.weights], fitness: 0 };
      const localSigma = 0.08 + this.rewards.speed / 500;
      const challengers = Array.from({ length: 31 }, () => this.makeBrain(this.protectedBrain, localSigma));
      this.population = [
        { weights: [...this.protectedBrain.weights], fitness: 0 },
        ...challengers,
        ...this.population.slice(0, this.populationSize - challengers.length - 1)
      ];
    }
    this.successes = [];
    this.crashes = 0;
    this.bestEver = null;
    this.bestSuccessful = null;
    this.startGeneration();
  }

  makeAgent(brain, index, start = this.start) {
    return {
      brain, index, x: start.x, y: start.y, angle: start.angle,
      reward: 0, alive: true, reached: false, path: [{ x: start.x, y: start.y }],
      leftSpeed: 0, rightSpeed: 0, forward: 0, angularVelocity: 0, turnGrip: 1, brakingDistance: 0,
      previousDistance: Math.hypot(this.goal.x - start.x, this.goal.y - start.y),
      obstacles: start.obstacles || null, minClearance: Infinity, finishedStep: 300,
      rewardBreakdown: { approach: 0, goal: 0, speed: 0, collision: 0, clearance: 0, energy: 0, turning: 0, boundary: 0, unfinished: 0 }
    };
  }

  addReward(agent, category, value) {
    agent.reward += value;
    agent.rewardBreakdown[category] += value;
  }

  startGeneration() {
    this.isEvaluating = false;
    this.steps = 0;
    this.agents = this.population.map((brain, index) => this.makeAgent(brain, index, {
      ...this.start, angle: this.start.angle + (this.random() - 0.5) * 0.8
    }));
  }

  startEvaluation(brain, scenarios) {
    this.isEvaluating = true;
    this.obstacles = scenarios[0].obstacles;
    this.steps = 0;
    this.evaluationFinalized = false;
    this.agents = scenarios.map((scenario, index) => this.makeAgent(brain, index, {
      x: this.start.x + scenario.xOffset,
      y: this.start.y + scenario.yOffset,
      angle: this.start.angle + scenario.angleOffset,
      obstacles: scenario.obstacles
    }));
  }

  stepEvaluation(iterations = 1) {
    for (let iteration = 0; iteration < iterations; iteration++) {
      if (this.steps >= 300 || this.agents.every(agent => !agent.alive)) return true;
      this.steps++;
      for (const agent of this.agents) this.stepAgent(agent, 1 / 30);
    }
    return this.steps >= 300 || this.agents.every(agent => !agent.alive);
  }

  evaluationResult() {
    if (!this.evaluationFinalized) {
      for (const agent of this.agents) {
        if (agent.alive) {
          this.addReward(agent, 'unfinished', -agent.previousDistance * 0.03 * (this.rewards.safety / 75));
        }
      }
      this.evaluationFinalized = true;
    }
    const successes = this.agents.filter(agent => agent.reached).length;
    const crashes = this.agents.filter(agent => agent.crashed).length;
    const best = this.agents.find(agent => agent.reached) || this.bestAgent();
    const breakdown = {};
    for (const key of Object.keys(this.agents[0].rewardBreakdown)) {
      breakdown[key] = this.agents.reduce((sum, agent) => sum + agent.rewardBreakdown[key], 0) / this.agents.length;
    }
    const averageTime = this.agents.reduce((sum, agent) => sum + agent.finishedStep / 30, 0) / this.agents.length;
    const clearances = this.agents.map(agent => Number.isFinite(agent.minClearance) ? agent.minClearance : 380);
    const averageClearance = clearances.reduce((sum, value) => sum + value, 0) / clearances.length;
    const deploymentScore = successes * 10 - crashes * 3 - Math.max(0, averageTime - 6) + Math.min(5, averageClearance / 30);
    return {
      attempts: this.agents.length,
      successes,
      crashes,
      successRate: Math.round(successes / this.agents.length * 100),
      averageTime,
      averageClearance,
      deploymentScore,
      averageReward: this.agents.reduce((sum, agent) => sum + agent.reward, 0) / this.agents.length,
      breakdown,
      passed: successes >= 7 && crashes <= 4,
      path: best ? [...best.path, { x: best.x, y: best.y }] : []
    };
  }

  inputs(agent) {
    const dx = this.goal.x - agent.x;
    const dy = this.goal.y - agent.y;
    const distance = Math.hypot(dx, dy);
    const goalAngle = Math.atan2(dy, dx);
    const relativeGoal = this.wrap(goalAngle - agent.angle);
    let nearestDistance = 380;
    let nearestAngle = 0;
    const obstacles = agent.obstacles || this.obstacles;
    for (const obstacle of obstacles) {
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
      Math.min(1, nearestDistance / 380),
      Math.sin(nearestAngle),
      Math.max(-1, Math.min(1, (agent.forward || 0) / 135)),
      Math.max(-1, Math.min(1, (agent.angularVelocity || 0) / 1.8))
    ];
  }

  infer(brain, inputs) {
    const w = brain.weights;
    const hidden = new Array(this.hiddenSize);
    let cursor = 0;
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = 0;
      for (let i = 0; i < this.inputSize; i++) sum += inputs[i] * w[cursor++];
      hidden[h] = Math.tanh(sum + w[this.weightCount + h]);
    }
    const output = [0, 0];
    for (let o = 0; o < this.outputSize; o++) {
      let sum = 0;
      for (let h = 0; h < this.hiddenSize; h++) sum += hidden[h] * w[cursor++];
      output[o] = Math.tanh(sum + w[this.weightCount + this.hiddenSize + o]);
    }
    return output;
  }

  motorOutputs(brain, inputs) {
    return this.infer(brain, inputs).map(value => 0.1 + (value + 1) * 0.425);
  }

  stepAgent(agent, dt) {
    if (!agent.alive) return;
    const [leftRaw, rightRaw] = this.motorOutputs(agent.brain, this.inputs(agent));
    const speedScale = 135;
    const targetLeft = leftRaw * speedScale;
    const targetRight = rightRaw * speedScale;
    const physics = this.difficultyProfiles[this.difficulty];
    const approachSpeed = (current, target) => {
      const limit = (target >= current ? physics.acceleration : physics.braking) * dt;
      return current + Math.max(-limit, Math.min(limit, target - current));
    };
    agent.leftSpeed = approachSpeed(agent.leftSpeed, targetLeft);
    agent.rightSpeed = approachSpeed(agent.rightSpeed, targetRight);
    const left = agent.leftSpeed;
    const right = agent.rightSpeed;
    const forward = (left + right) * 0.5;
    const requestedAngularVelocity = (left - right) * 0.014;
    const lateralLimit = physics.lateralAcceleration / Math.max(18, Math.abs(forward));
    const targetAngularVelocity = Math.max(-lateralLimit, Math.min(lateralLimit, requestedAngularVelocity));
    const angularStep = physics.angularAcceleration * dt;
    agent.angularVelocity += Math.max(-angularStep, Math.min(angularStep, targetAngularVelocity - agent.angularVelocity));
    const turnGrip = Math.abs(requestedAngularVelocity) < 1e-6 ? 1 : Math.min(1, Math.abs(agent.angularVelocity / requestedAngularVelocity));
    agent.forward = forward;
    agent.turnGrip = turnGrip;
    agent.brakingDistance = forward * forward / 480;
    agent.angle += agent.angularVelocity * dt;
    agent.x += Math.cos(agent.angle) * forward * dt;
    agent.y += Math.sin(agent.angle) * forward * dt;

    const distance = Math.hypot(this.goal.x - agent.x, this.goal.y - agent.y);
    const progress = agent.previousDistance - distance;
    this.addReward(agent, 'approach', progress * (this.rewards.safety / 25));
    const objectiveScale = Math.min(1, (this.rewards.safety + this.rewards.goal + this.rewards.crash) / 30);
    this.addReward(agent, 'energy', -(left * left + right * right) * dt * 0.000022 * objectiveScale);
    this.addReward(agent, 'turning', -Math.abs(right - left) * Math.abs(forward) * dt * 0.00012 * objectiveScale);
    agent.previousDistance = distance;

    let nearest = Infinity;
    const obstacles = agent.obstacles || this.obstacles;
    for (const obstacle of obstacles) {
      const d = Math.hypot(agent.x - obstacle.x, agent.y - obstacle.y) - obstacle.r - 10;
      nearest = Math.min(nearest, d);
      if (d <= 0 && agent.alive) {
        this.addReward(agent, 'collision', -this.rewards.crash * 6);
        agent.alive = false;
        agent.crashed = true;
        agent.finishedStep = this.steps;
      }
    }
    agent.minClearance = Math.min(agent.minClearance, nearest);
    const effectiveClearance = nearest - agent.brakingDistance;
    if (effectiveClearance < 80) {
      this.addReward(agent, 'clearance', -(80 - effectiveClearance) * dt * this.rewards.crash / 180);
    }
    if (agent.alive && distance < this.goalRadius) {
      this.addReward(agent, 'goal', this.rewards.goal * 3.75);
      this.addReward(agent, 'speed', this.rewards.goal > 0 ? (300 - this.steps) * 0.15 : 0);
      agent.alive = false;
      agent.reached = true;
      agent.finishedStep = this.steps;
    }
    if (agent.alive && (agent.x < 35 || agent.x > 865 || agent.y < 30 || agent.y > 490)) {
      this.addReward(agent, 'boundary', -this.rewards.crash * 0.65);
      agent.alive = false;
      agent.finishedStep = this.steps;
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
      if (agent.alive) {
        this.addReward(agent, 'unfinished', -agent.previousDistance * 0.03 * (this.rewards.safety / 75));
        agent.finishedStep = 300;
      }
      agent.brain.fitness = agent.reward;
      if (agent.reached && (this.rewards.goal > 0 || this.rewards.safety > 0) && (!this.bestSuccessful || agent.reward > this.bestSuccessful.fitness)) {
        this.bestSuccessful = {
          weights: [...agent.brain.weights], fitness: agent.reward, successful: true,
          path: [...agent.path, { x: agent.x, y: agent.y }], rewardBreakdown: { ...agent.rewardBreakdown }
        };
      }
      this.successes.push(agent.reached ? 1 : 0);
      if (agent.crashed) this.crashes++;
    }
    if (this.successes.length > 100) this.successes.splice(0, this.successes.length - 100);
    this.evaluations += this.populationSize;
    if (this.rewards.safety + this.rewards.goal + this.rewards.crash === 0) {
      this.startGeneration();
      return;
    }
    this.population.sort((a, b) => b.fitness - a.fitness);
    if (!this.bestEver || this.population[0].fitness > this.bestEver.fitness) {
      const bestAgent = this.agents.find(agent => agent.brain === this.population[0]);
      this.bestEver = { weights: [...this.population[0].weights], fitness: this.population[0].fitness,
        rewardBreakdown: bestAgent ? { ...bestAgent.rewardBreakdown } : null };
    }
    const elites = this.population.slice(0, 8);
    const exploration = 0.015 + this.rewards.speed / 70;
    const sigma = Math.max(0.025, exploration * Math.pow(0.982, this.generation));
    const next = this.protectedBrain
      ? [{ weights: [...this.protectedBrain.weights], fitness: 0 }]
      : [];
    for (const elite of elites) {
      if (next.length >= 8) break;
      next.push({ weights: [...elite.weights], fitness: 0 });
    }
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
