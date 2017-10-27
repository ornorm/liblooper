# LIBLOOPER
> Looper implementation for use in conjonction with the HJS-MESSAGE messaging API. This is the browser version of the 
looper.

Looper classes: Looper, MessageLooper.

## Installation

Node:

```sh
npm install liblooper --save
```
## Usage
 The **Looper** is used to run messages synchronized with animation frames. **requestAnimationFrame** by default
  do not have a message loop associated with them; to create one, call **Looper.createLoopHandler** in the 
  script that is to run the loop.
 
 Most interaction with a message loop is through the **MessageLooper** that is a subclass class of **MessageHandler**. 
  
 Your can create any number of **MessageLooper**'s but only one loop is running in the entire application. But it's 
 recommanded to use only one global instance of **Looper**.
  
 
###### Create a MessageLooper

```javascript
import {Looper} from 'liblooper';

// this create an instanceof MessageHandler that run in the loop
let ML = Looper.createLoopHandler({
    
    fps: 40 /* An optional FPS is accepted (60 is default) */,
    
    quitAllowed: false /* An optional quit flag is accepted (true is default) */,
    
    handleMessage(msg) {
        // enter frame here
        // handle messages interactions
        return true;
    },
    
    handleRender(interpolation) {
        // render frame here
        // handle drawing on canvas for ex.
    },
    
    handleExit(fps, panic=false) {
        // exit frame here
        // clean code for example
    }

});
```
###### Pause/Resume/Exit from a loop

```javascript
import {Looper} from 'liblooper';

const START_CMD = 0xffddcc;
const PAUSE_CMD = 0xffddcd;
const RESUME_CMD = 0xffddce;
const EXIT_CMD = 0xffddde;

// this create an instance of MessageLooper that run in the loop
// All parameters accepted by a MessageHandler are accepted by MessageLooper's
let ML = Looper.createLoopHandler({
    
    handleMessage(msg) {
        let what = msg.what;
        switch(what) {
            case START_MSG:
                this.sendEmptyMessage(PAUSE_CMD);
                break;
            case PAUSE_CMD:
                this.pause();
                // now messages are sending only with the message queue
                // handle render and handle exit are no more called
                this.sendEmptyMessage(RESUME_CMD);
                break;
            case RESUME_CMD:
                this.resume();
                // now messages are sending throw the loop
                // handle render and handle exit are called
                this.sendEmptyMessage(EXIT_CMD);
                break;
            case EXIT_CMD:
                this.exit();
                break;
        }
        return true;
    },
    
    handleRender(interpolation) {
        console.log(interpolation);
    },
    
    handleExit(fps, panic=false) {
        console.log(fps);
    }

});

ML.sendEmptyMessage(START_MSG);
```
## Contacts

[Aime - abiendo@gmail.com](abiendo@gmail.com)

Distributed under the MIT license. See [``LICENSE``](./LICENSE.md) for more information.