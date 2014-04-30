/**
* WorkerQueue.js
* Class to handle long-running, asynchronous tasks.
* http://thereisamoduleforthat.com/content/workerqueue-background-tasks-javascript
*/

const {
  setInterval,
  clearInterval
} = require("sdk/timers");

WorkerQueue = function(frequency) {
 
  this.queue = [];
  this.timeout = 0;
  this.current = null;
  this.frequency = frequency;
 
  this.pop = function() {
    if (!this.current) {
      if (!this.queue.length) {
        clearInterval(this.timeout);
        this.timeout = 0;
        return;
      }
      this.current = this.queue.shift();
    }
    if (this.current()) {
      this.current = null;
    }
  }
 
  this.push = function(task) {
    var self = this;
    this.queue.push(task);
    if (!this.timeout) {
      this.timeout = setInterval(function(){ self.pop(); }, this.frequency);
    }
    this.pop();
  }

}

exports.WorkerQueue = WorkerQueue;
