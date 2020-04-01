var H5P = H5P || {};

H5P.ReactionTimer = (function ($) {

  /**
   * Constructor function.
   */
  function C(options, id) {
    H5P.EventDispatcher.call(this);
    // Extend defaults with provided options
    this.options = $.extend(true, {}, {
      repetitions: 5
    }, options);
    // Keep provided id.
    this.id = id;
    
    this.timeStart = 0;
    this.timeStop = 0;
    this.started = false;
    this.waiting = false;
    this.responded = false;
    this.completed = false;
    this.average = 0;
    this.attempts = 0;
    this.reactionTimes = [];
    this.timeout = null;
    this.countdownInterval = null;
  };

  /**
   * Attach function called by H5P framework to insert H5P content into
   * page
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    let self = this;

    // Set class on container to identify it as a greeting card
    // container.  Allows for styling later.
    $container.addClass("h5p-reactiontimer");

    $container.append(`
    <div class="stimuli-wrapper">
      <button id="stimuli" class="stimuli" type="button" disabled>
        <span class="inner-content" data-content="Click start"></span>
      </button>
    </div>`);
    
    $container.append(`
    <div class="h5p-controls">
      <button id="advancementBtn" class="h5p-joubelui-button h5p-button reactiontimer-startbutton">Start</button>
      <button id="resetBtn" class="h5p-joubelui-button h5p-button reactiontimer-retrybutton">Reset</button>
    </div>
    `);

    //$container.find('.h5p-controls').append(advancementBtn);
    
    // Show number of summary of trial
    $container.append(`
    <dl class="h5p-status">
      <dt class="repetitions-text">Average:</dt>
      <dd><span id="average">` + self.getAverageTime() + `</span>
      </dd>
      <dt class="repetitions-text">Tries:</dt>
      <dd><span id="attempts">` + self.attempts + `</span> of <span id="repetitions">` + self.options.repetitions + `</span>
      </dd>
    </dl>
    `);

    document.getElementById('stimuli').addEventListener('click', function (event) {
      if (!self.hasCompleted()) {
        self.disableStimuli();
        self.handleResponse(event);
      }
    });

    document.getElementById('advancementBtn').addEventListener('click', () => {
      this.disableAdvancement(true);
      if (!self.completed) {
        self.startTrial();
      } else {
        /* do nothing */
      }
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      self.reset();
    });
  };

  C.prototype.startTrial = function () {
    this.setStarted();
    this.countdown().then(() => {
      let timer = this.randWaitTime();
      this.disableStimuli(false);
      this.timeout = setTimeout(() => {
        let stimuli = document.getElementById('stimuli');
        if(!this.responded) {
          stimuli.classList.add('active');
          this.waiting = false;
          this.setStimuliText('Click!');
          this.startTimer();
        } else {
          /* Ignore previous response and clear */
          this.responded = false;
          stimuli.classList.remove('invalid');
          this.setStimuliText('Retry');
          this.disableAdvancement(false);
        }
      }, timer);
    });
  }

  C.prototype.startTimer = function () {
    this.timeStart = Date.now();
  }

  C.prototype.stopTimer = function () {
    this.timeStop = Date.now();
  }

  C.prototype.computeTime = function () {
    return this.timeStop - this.timeStart;
  }

  C.prototype.storeTime = function () {
    let result = this.computeTime();
    this.reactionTimes.unshift(result);
    return result;
  }

  C.prototype.computeAvg = function () {
    let total = this.reactionTimes.reduce((a, b) => a + b, 0);
    this.average = Math.round(total / this.reactionTimes.length);
    return average;
  }

  C.prototype.countdown = function (wait = 3) {
    return new Promise((resolve, reject) => {
      let counter = wait;
      this.setStimuliText(counter);
      this.countdownInterval = setInterval(() => {
        counter--;
        if (counter > 0) {
          this.setStimuliText(counter);
        } else {
          this.setStimuliText('Wait');
          clearInterval(this.countdownInterval);
          resolve();
        }
      }, 1000);
    });
  }

  C.prototype.setStarted = function (value = true) {
    document.getElementById('advancementBtn').innerHTML = 'Continue';
    this.started = value;
  }

  C.prototype.randWaitTime = function (min = 1, max = 3) {
    this.waiting = true;
    var min_ms = min * 1000;
    var max_ms = max * 1000;
    return Math.floor(Math.random() * (max_ms - min_ms) + min_ms);
  }

  /* * *
   * If time is less than 10 seconds display as milliseconds
   * If time is less than 60 seconds display as seconds
   * If greater than 60 seconds display N/A
   */
  C.prototype.formatReactionTime = function (reactionTime = 0) {
    let output = 'N/A';
    if(reactionTime > 0 && reactionTime < 10000) {
      output = reactionTime + ' ms';
    } else if(reactionTime >= 10000 && reactionTime < 60000) {
      /* * *
       * Convert to seconds and
       * round to 1 decimal place using
       * scaling trick: https://stackoverflow.com/a/11832950
       */
      let sec = reactionTime / 1000;
          sec = Math.round((sec + Number.EPSILON) * 10) / 10;
      output = sec + ' sec';
    }
    return output;
  }

  C.prototype.getAverageTime = function (raw = false) {
    if (raw) {
      return this.average;
    } else {
      return this.formatReactionTime(this.average);
    }
  }

  C.prototype.updateAverage = function (avg) {
    document.getElementById('average').innerHTML = this.getAverageTime();
  }

  C.prototype.updateAttempts = function () {
    this.attempts++;
    document.getElementById('attempts').innerHTML = this.attempts;
    this.hasCompleted();
  }

  C.prototype.hasCompleted = function () {
    this.completed = this.attempts >= this.options.repetitions;
    return this.completed;
  }

  C.prototype.setStimuliText = function (text) {
    let stimuli = document.getElementById('stimuli').querySelector('.inner-content');
        stimuli.setAttribute('data-content', text);
  }

  C.prototype.disableAdvancement = function (value = true) {
    let advancementBtn = document.getElementById('advancementBtn');
        advancementBtn.disabled = value;
  }

  C.prototype.disableStimuli = function (value = true) {
    let stimuli = document.getElementById('stimuli');
        stimuli.disabled = value;
    this.setStimuliText('Wait');
  }

  C.prototype.handleResponse = function (event) {
    let stimuli = document.getElementById('stimuli');
    this.stopTimer();
    this.responded = true;
    /* Check if input was too soon */
    if(this.waiting) {
      this.setStimuliText('Too Soon!');
      stimuli.classList.add('invalid');
    } else {
      this.storeTime();
      let avg = this.computeAvg();
      stimuli.classList.remove('active');
      this.updateAverage(avg);
      this.updateAttempts();
      let completed = this.hasCompleted();
      if (completed) {
        this.setStimuliText('Done!');
        this.disableAdvancement(true);
      } else {
        this.setStimuliText(this.formatReactionTime(this.reactionTimes[0]));
        this.disableAdvancement(false);
      }
      this.responded = false;
    }
  }

  C.prototype.reset = function () {
    /* Re-init variables */
    this.started = false;
    this.waiting = false;
    this.responded = false;
    this.completed = false;
    this.average = 0;
    this.attempts = 0;
    this.reactionTimes = [];
    
    /* Clear timeouts + intervals if trial in progress */
    clearInterval(this.countdownInterval);
    clearTimeout(this.timeout);

    /* Clear styling */
    this.disableAdvancement(false);
    document.getElementById('advancementBtn').innerHTML = 'Start';
    document.getElementById('average').innerHTML = this.getAverageTime();
    document.getElementById('attempts').innerHTML = this.attempts;
    let stimuli = document.getElementById('stimuli');
        stimuli.classList.remove('active');
        stimuli.classList.remove('invalid');

    this.setStimuliText('Click start');
  }

  return C;
})(H5P.jQuery);