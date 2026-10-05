# Third-party notices

## JavaScript OPL emulator

`vendor/opl3.js` is the emulator core from the published `opl3@0.4.3` npm package by IDDQD (2016), based on the Yamaha YMF262 emulator by Robson Cozendey. Source: https://github.com/doomjs/opl3 and https://www.npmjs.com/package/opl3.

The published package declares the MIT license. Its tarball SHA-1 is `bf22cea011e0b7e7f3ff6b63748add5ea2a44caa`. Only `lib/opl3.js` was adapted: CommonJS export was replaced with an ES module export, `extend` with `Object.assign`, and `util.inherits` with a local equivalent. The synthesis implementation remains upstream code. No example game files, GENMIDI bank, or native audio dependencies are included.

MIT License

Copyright (c) 2016 IDDQD. Original OPL3 emulator by Robson Cozendey.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## PeerJS

COMM-BAT PLAY > WEBRTC PEERJS (`src/net/peerjs.js`) bundles the `peerjs@1.5.5` npm package, https://peerjs.com, into the page. It is MIT licensed:

```
Copyright (c) 2015 Michelle Bu and Eric Zhang, http://peerjs.com

(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

The page contacts PeerJS's free cloud signaling server (0.peerjs.com) only when the player opens WEBRTC PEERJS (`docs/comm-bat.md`).

## ws

`tools/lan-server.mjs` and the development server's signaling (`src/net/signal-server.js`) use the `ws` npm package (MIT, https://github.com/websockets/ws) on the machine that serves the page; it is not part of the page and not in `dist/`.

## Format research

The local `docs/` references link to ModdingWiki and identify uncertainties. The viewer’s parsers were written for this project from those format descriptions and the locally supplied original files. Game data remains in the ignored `game/` directory and is not part of the code repository or build.
