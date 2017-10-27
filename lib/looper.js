/** @babel */
import EventEmitter from 'events';
import {MessageHandler,Messenger} from 'hjs-message/lib/handler';
import {MessageQueue} from 'hjs-message/lib/queue';

let simulationTimestep = 1000 / 60,
    frameDelta = 0,
    lastFrameTimeMs = 0,
    fps = 60,
    lastFpsUpdate = 0,
    framesThisSecond = 0,
    numUpdateSteps = 0,
    minFrameDelay = 0,
    running = false,
    started = false,
    panic = false;

    const requestAnimationFrame = window.requestAnimationFrame || (() => {

        let lastTimestamp = Date.now(),
                now,
                timeout;

            return (callback) => {
                now = Date.now();
                timeout = Math.max(0, simulationTimestep - (now - lastTimestamp));
                lastTimestamp = now + timeout;
                return setTimeout(() => {
                    callback(now + timeout);
                }, timeout);
            };

        })();

    const cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

    const NOOP = () => {};

    let begin = NOOP,
    update = NOOP,
    draw = NOOP,
    end = NOOP,
    rafHandle;

const loop = (timestamp) => {
    rafHandle = requestAnimationFrame(loop);
    if (timestamp < lastFrameTimeMs + minFrameDelay) {
        return;
    }
    frameDelta += timestamp - lastFrameTimeMs;
    lastFrameTimeMs = timestamp;
    begin(timestamp, frameDelta);
    if (timestamp > lastFpsUpdate + 1000) {
        fps = 0.25 * framesThisSecond + 0.75 * fps;
        lastFpsUpdate = timestamp;
        framesThisSecond = 0;
    }
    framesThisSecond++;
    numUpdateSteps = 0;
    while (frameDelta >= simulationTimestep) {
        update(simulationTimestep);
        frameDelta -= simulationTimestep;
        if (++numUpdateSteps >= 240) {
            panic = true;
            break;
        }
    }
    draw(frameDelta / simulationTimestep);
    end(fps, panic);
    panic = false;
};

const MainLoop = {

    getSimulationTimestep() {
        return simulationTimestep;
    },

    setSimulationTimestep(timestep) {
        simulationTimestep = timestep;
        return this;
    },

    getFPS() {
        return fps;
    },

    getMaxAllowedFPS() {
        return 1000 / minFrameDelay;
    },

    setMaxAllowedFPS(fps=Infinity) {
        if (fps === 0) {
            fps = 60;
        }
        minFrameDelay = 1000 / fps;
        return this;
    },

    resetFrameDelta() {
        let oldFrameDelta = frameDelta;
        frameDelta = 0;
        return oldFrameDelta;
    },

    setBegin(fun) {
        begin = fun || begin;
        return this;
    },

    setUpdate(fun) {
        update = fun || update;
        return this;
    },

    setDraw(fun) {
        draw = fun || draw;
        return this;
    },

    setEnd(fun) {
        end = fun || end;
        return this;
    },

    start() {
        if (!started) {
            started = true;
            rafHandle = requestAnimationFrame((timestamp) => {
                draw(1);
                running = true;
                lastFrameTimeMs = timestamp;
                lastFpsUpdate = timestamp;
                framesThisSecond = 0;
                rafHandle = requestAnimationFrame(loop);
            });
        }
        return this;
    },

    stop() {
        running = false;
        started = false;
        cancelAnimationFrame(rafHandle);
        return this;
    },

    isRunning() {
        return running;
    }

};

let PAUSED = false;
let MAIN_LOOPER = null;
let LOOPER = null;

const prepareMainLooper = (quitAllowed = true, fps=60) => {
    if (LOOPER) {
        throw new ReferenceError("RuntimeException Only one Looper may be created per application");
    }
    return LOOPER = new Looper(
        quitAllowed,
        fps
    );
};

const EXIT_FRAME = 'exit_frame';
const RENDER_FRAME = 'render_frame';

export class Looper extends EventEmitter {

    constructor(quitAllowed = true, fps=60) {
        super();
        this.mQueue = new MessageQueue(quitAllowed);
        this.mQueue.mLooper = this;
        MainLoop.setMaxAllowedFPS(fps)
            .setUpdate((delta) => {
                this.loop(delta);
            })
            .setDraw((interpolation) => {
                this.render(interpolation);
            })
            .setEnd((fps, panic) => {
                this.exit(fps, panic);
            });
    }

    static createLoopHandler({
                                 callback = null,
                                 asynchronous = true,
                                 messenger = new Messenger(),
                                 handleMessage = null,
                                 unHandleMessage = null,
                                 handleExit = null,
                                 handleRender = null,
                                 scheduleTime = 200,
                                 quitAllowed=true,
                                 fps=60
                             } = {}) {
        let looper = Looper.myLooper();
        if (!looper) {
            looper = Looper.prepare(quitAllowed, fps);
        }
        return new MessageLooper({
            callback,
            asynchronous,
            messenger,
            handleMessage,
            unHandleMessage,
            handleExit,
            handleRender,
            scheduleTime,
            looper
        })
    }

    exit(fps, panic) {
        this.emit(EXIT_FRAME, { fps, panic });
    }

    getMainLooper() {
        return MainLoop;
    }

    getQueue() {
        return this.mQueue;
    }

    isIdling() {
        return this.mQueue.isIdle();
    }

    isRunning() {
        return MainLoop.isRunning();
    }

    loop(delta) {
        let queue = this.mQueue,
            msg = queue.nextMessage();
        if (msg) {
            let target = msg.target;
            if (!target) {
                return;
            }
            let handled = target.dispatchMessage(msg);
            if (!handled) {
                target.unHandleMessage(msg);
            }
            msg.recycle();
        }
    }

    static myLooper() {
        return LOOPER;
    }

    static myQueue() {
        let looper = Looper.myLooper();
        if (looper) {
            return looper.mQueue;
        }
        return null;
    }

    pause() {
        if (!PAUSED) {
            PAUSED = !PAUSED;
            MainLoop.stop();
        }
    }

    static prepare(quitAllowed = true, fps=60) {
        let looper = prepareMainLooper(quitAllowed, fps);
        if (MAIN_LOOPER) {
            throw new ReferenceError("IllegalStateException The main Looper has already been prepared.");
        }
        MAIN_LOOPER = looper.start();
    }

    quit(safe=true) {
        MainLoop.stop();
        this.mQueue.quit(safe);
        if (safe) {
            this.removeAllListeners(EXIT_FRAME);
            this.removeAllListeners(RENDER_FRAME);
            this.mQueue = null;
        }
    }

    quitSafely() {
        this.quit(true);
    }

    render(interpolation) {
        this.emit(RENDER_FRAME, { interpolation });
    }

    resume() {
        if (PAUSED) {
            PAUSED = !PAUSED;
            MainLoop.start();
        }
    }

    start() {
        if (!this.isRunning()) {
            return MainLoop.start();
        }
    }

    toggle() {
        PAUSED ? this.resume() : this.pause();
    }

}

export class MessageLooper extends MessageHandler {

    constructor({
                    callback = null,
                    asynchronous = true,
                    messenger = new Messenger(),
                    handleMessage = null,
                    unHandleMessage = null,
                    handleRender = null,
                    handleExit = null,
                    scheduleTime = 200,
                    looper=null
                } = {}) {
        super({callback, asynchronous, queue:looper ? looper.getQueue() : Looper.myQueue(), messenger, handleMessage, unHandleMessage, scheduleTime});
        this.looper = looper || Looper.myLooper();
        if (handleRender) {
            this.handleRender = handleRender;
        }
        if (handleExit) {
            this.handleExit = handleExit;
        }
        if (this.looper) {
            this.looper.on(RENDER_FRAME, ({ interpolation }) => {
                this.handleRender(interpolation);
            });
            this.looper.on(EXIT_FRAME, ({ fps, panic }) => {
                this.handleRender(fps, panic);
            });
        }
    }

    exit() {
        if (this.looper) {
            this.looper.quitSafely();
        }
    }

    getLooper() {
        if (this.looper) {
            return this.looper;
        }
        return null;
    }

    getMainLooper() {
        if (this.looper) {
            return this.looper.getMainLooper();
        }
        return null;
    }

    handleExit(fps, panic) {

    }

    handleRender(interpolation) {

    }

    pause() {
        if (this.looper) {
            this.looper.pause();
        }
    }

    resume() {
        if (this.looper) {
            this.looper.resume();
        }
    }

    toggle() {
        if (this.looper) {
            this.looper.toggle();
        }
    }
}
