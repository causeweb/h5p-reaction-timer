var H5P = H5P || {};

H5P.ReactionTimer = (function ($) {

  /**
   * Constructor function.
   */
  function C(options, id) {
    H5P.EventDispatcher.call(this);
    // Extend defaults with provided options
    this.options = $.extend(true, {}, {
      instructions: '',
      repetitions: 5,
      countdownTime: 0,
      waitTimeGroup: {
        waitTimeMin: 1,
        waitTimeMax: 5
      }
    }, options);
    // Keep provided id.
    this.id = id;

    this.stimuli = null;
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

    if(this.options.instructions) {
      $container.append(`
      <div class="h5p-instructions">
        <strong>Instructions:</strong>
        ` + this.options.instructions + `
      </div>`);
    }

    let stimuliOuter = $('<div/>', {
      'class': 'h5p-stimuli-outer'
    });

    let stimuli = $('<button/>', {
      'id': 'h5p-stimuli',
      'class': 'stimuli'
    })
    .attr('disabled', true)
    .click(function() {
      self.trigger('stimuliInteraction')
    });
    
    let stimuliInner = $('<span/>', {
      'id': 'h5p-stimuli-inner',
      'class': 'inner-content'
    });

    let results = $('<div/>', {
      'class': 'h5p-results'
    });

    $('.h5p-results').hide();

    $(stimuliOuter).append(stimuli);
    $(stimuli).append(stimuliInner);
    $container.append(stimuliOuter);
    $container.append(results);

    let controls = $('<div/>', { 'class': 'h5p-controls'});

    let advancementBtn = H5P.JoubelUI.createSimpleRoundedButton('Start');
        advancementBtn.addClass('rt-advancementbutton');
        advancementBtn.attr('id', 'advancementBtn');

    let resetBtn = H5P.JoubelUI.createSimpleRoundedButton('Reset');
        resetBtn.addClass('rt-resetbutton');
        resetBtn.attr('id', 'resetBtn');

    let resultsBtn = H5P.JoubelUI.createSimpleRoundedButton('Show Results');
      resultsBtn.addClass('rt-resultsbutton');
      resultsBtn.attr('id', 'resultsBtn');
      resultsBtn.hide();

    $(controls).append(resultsBtn, advancementBtn, resetBtn);

    $container.append(controls);

    // Show number of summary of trial
    $container.append(`
    <dl class="h5p-status">
      <dt class="repetitions-text">Attempts:</dt>
      <dd>
        <span id="attempts"></span>
        <span id="tries">` + self.attempts + `</span> of <span id="repetitions">` + self.options.repetitions + `</span>
      </dd>
      <dt class="repetitions-text">Average (mean):</dt>
      <dd><span id="average">` + self.getAverageTime('sec') + `</span>
      </dd>
    </dl>
    `);

    $(advancementBtn).click(function() {
      self.triggerXAPI('interacted', 'continue');
      self.trigger('advancement');
    });

    $(resetBtn).click(function() {
      self.triggerXAPI('voided');
      self.trigger('reset');
    });

    $(resultsBtn).click(function() {
      self.triggerXAPI('asked');
      self.trigger('showResults');
    });

    this.on('stimuliInteraction', function (event) {
       if (!self.hasCompleted()) {
        /* If waiting; responded too quickly */
        if(this.waiting){
          /* Ignore response and clear */
          clearTimeout(self.timeout);
          setTimeout(() => {
            this.responded = false;
            this.stimuli.classList.remove('invalid');
            this.setStimuliText('Retry');
            this.disableAdvancement(false);
          }, 1500); /* Give time to digest message */
        }
        self.disableStimuli();
        self.handleResponse(event);
       }
    });

    this.on('advancement', function () {
      this.disableAdvancement(true);
      if (!self.completed) {
        self.startTrial();
      } else {
        /* do nothing */
      }
    });

    this.on('reset', function () {
      self.reset();
    });

    this.on('showResults', function () {
      self.showResults();
    });

    this.stimuli = document.getElementById('h5p-stimuli');
  };

  C.prototype.triggerXAPI = function (verb = 'interacted', details) {
    var xAPIEvent = this.createXAPIEventTemplate(verb);

    if(verb == 'attempted') {
      if(details == 'early'){
        xAPIEvent.setScoredResult(-1, 1, self, false, false);
      } else {
        xAPIEvent.setScoredResult(this.reactionTimes[0], 1, self, false, true);
      }
    } else if (verb == 'completed') {
      xAPIEvent.setScoredResult(this.reactionTimes[0], 1, self, true, true);
    } else {
      
    }

    this.trigger(xAPIEvent);
    console.log(xAPIEvent.data.statement);
  }

  C.prototype.startTrial = function () {
    let waitTime = this.options.countdownTime ? this.options.countdownTime : 0;
    this.setStarted();
    this.countdown(waitTime).then(() => {
      let timer = this.randWaitTime();
      this.disableStimuli(false);
      this.timeout = setTimeout(() => {
        if(!this.responded) {
          this.stimuli.classList.add('active');
          this.waiting = false;
          this.setStimuliText('Click!');
          this.startTimer();
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

  C.prototype.computeResults = function () {
    let percentile = this.getPercentile();
    let digit = percentile.toString().slice(-1);
    let ending = '';

    if (digit == "1") {
      ending = "st";
    } else if (digit == "2") {
      ending = "nd";
    } else if (digit == "3") {
      ending = "rd";
    } else {
      ending = "th";
    }

    $('.h5p-results').html(`<p>Your average (mean) time of <b>${this.getAverageTime('sec')}</b> ranks in the <b>${percentile}${ending}</b> percentile of all recorded times.</p>
    <div class="sample-data"></div>`);

    $('#resultsBtn').hide();
  }

  C.prototype.countdown = function (wait = 0) {
    return new Promise((resolve, reject) => {
      let counter = wait;
      let text = wait > 0 ? counter : 'Get ready!';
      this.setStimuliText(text);

      if(wait > 0) {
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
      } else {
        resolve();
      }
    });
  }

  C.prototype.setStarted = function (value = true) {
    document.getElementById('advancementBtn').innerHTML = 'Continue';
    this.started = value;
  }

  C.prototype.sampleTimes = function() {
    const sample = [172.4377,188.7274,205.997,209.9946,232.6494,241.7846,247.5073,256.1078,265.738,277.3069,278.4246,288.502,293.1073,301.6239,318.6322,323.222,324.9026,325.8464,332.3318,335.8619,337.1097,339.9816,345.9363,354.39,357.2129,358.3283,362.5386,365.7027,380.1032,387.1377,387.8648,390.8152,392.5195,392.8928,399.3687,405.6453,409.949,417.5202,421.5327,423.1982,428.0762,432.8053,439.3381,447.744,454.1692,456.8289,458.6833,460.5304,461.7891,463.7745,465.5371,466.4259,468.4489,473.2009,480.5006,488.859,495.1843,499.6697,502.9291,506.768,511.955,513.0341,516.7706,525.4836,533.5727,539.5461,546.5797,549.0832,568.7169,605.6833,615.7043,620.1642,625.9605,626.8282,628.5691,634.4895,639.5857,642.6185,645.2881,646.882,655.3925,673.8686,680.6684,692.2268,705.5426,707.1181,711.379,721.0491,742.7233,760.8832,804.5089,818.6854,842.8914,875.8373,891.2556,937.4281,943.1703,975.8158,1012.7955,1082.0036,1194.6269];

    return sample;
  }

  C.prototype.getPercentile = function(average = this.average) {
    let sample = this.sampleTimes();
    let percentile = sample.indexOf(sample.find(
      element => element > average
    ));

    return percentile;
  }

  C.prototype.randWaitTime = function (min = this.options.waitTimeGroup.waitTimeMin, max = this.options.waitTimeGroup.waitTimeMax) {
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
  C.prototype.formatReactionTime = function (reactionTime = 0, format = 'ms', raw = false) {
    let output = 'N/A';
    if((reactionTime > 0 && reactionTime < 10000) && format == 'ms') {
      output = raw ? reactionTime : reactionTime + ' ms';
    } else if((reactionTime >= 10000 && reactionTime < 60000) || (reactionTime && format == 'sec')) {
      /* * *
       * Convert to seconds and
       * round to 3 decimal places using
       * scaling trick: https://stackoverflow.com/a/11832950
       */
      let sec = reactionTime / 1000;
          sec = Math.round((sec + Number.EPSILON) * 1000) / 1000;
      output = raw ? sec : sec + ' sec';
    }
    return output;
  }

  C.prototype.getAverageTime = function (format = 'ms') {
    if (format == 'raw') {
      return this.average;
    } else if (format == 'sec') {
      return this.formatReactionTime(this.average, format);
    } else {
      return this.formatReactionTime(this.average, format);
    }
  }

  C.prototype.updateAverage = function () {
    this.computeAvg();
    document.getElementById('average').innerHTML = this.getAverageTime('sec');
  }

  C.prototype.listAttempts = function () {
    let list = [];
    this.reactionTimes.forEach(value => {
      list.push(this.formatReactionTime(value, 'sec', true));
    });
    document.getElementById('attempts').innerHTML = '{ ' + list.join(', ') + ' } sec';
  }

  C.prototype.updateAttempts = function () {
    this.attempts++;
    document.getElementById('tries').innerHTML = this.attempts;
    this.hasCompleted();
  }

  C.prototype.hasCompleted = function () {
    this.completed = this.attempts >= this.options.repetitions;
    return this.completed;
  }

  C.prototype.showResults = function (value = true) {
    if(value) {
      this.computeResults();
      $('.h5p-results').show();
      $('.h5p-stimuli-outer').hide();
    } else {
      $('.h5p-results').hide();
      $('.h5p-stimuli-outer').show();
    }
  }

  C.prototype.setStimuliText = function (text) {
    this.stimuli.querySelector('.inner-content').setAttribute('data-content', text);
  }

  C.prototype.disableAdvancement = function (value = true) {
    let advancementBtn = document.getElementById('advancementBtn');
        advancementBtn.setAttribute('disabled', value);
  }

  C.prototype.disableStimuli = function (value = true) {
    this.stimuli.disabled = value;
  }

  C.prototype.handleResponse = function (event) {
    this.stopTimer();
    this.responded = true;
    /* Check if input was too soon */
    if(this.waiting) {
      this.triggerXAPI('attempted', 'early');
      this.setStimuliText('Too Soon');
      this.stimuli.classList.add('invalid');
    } else {
      this.storeTime();
      this.stimuli.classList.remove('active');
      this.updateAverage();
      this.updateAttempts();
      this.listAttempts();

      /* Check if completed, if not, proceed */
      if (this.hasCompleted()) {
        this.triggerXAPI('completed');
        this.setStimuliText('Complete');
        this.stimuli.classList.add('valid');
        this.disableAdvancement(true);
        $('#advancementBtn').hide();
        $('#resultsBtn').show();
      } else {
        this.triggerXAPI('attempted');
        this.setStimuliText(this.formatReactionTime(this.reactionTimes[0], 'sec'));
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
    document.getElementById('average').innerHTML = this.getAverageTime('sec');
    document.getElementById('tries').innerHTML = this.attempts;
    document.getElementById('attempts').innerHTML = '';
    this.stimuli.classList.remove(
      'active',
      'valid',
      'invalid'
    );
    this.setStimuliText('');

    /* Hide results */
    this.showResults(false);
    $('#resultsBtn').hide();
    $('#advancementBtn').show();
  }

  return C;
})(H5P.jQuery);