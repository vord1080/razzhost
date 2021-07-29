// figure out the defaults - if the defaults aren't set, assume one week.
const expirationTtl = weeksToSeconds(DEFAULT_EXPIRATION || 1);
const DEFAULT_ERROR_MESSAGE = "<title>404 Not Found</title><h1>Not Found</h1><p>The requested URL was not found on this server.<hr><address>Apache/2.2.22 (Linux) Server at Port 80</address>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const routes = {
  "/upload": async function (request, requestURL) {
    const authKey = request.headers.get("authorization");
    if (authKey !== UPLOAD_KEY) {
      return new Response("Invalid Credentials", {
        status: 403,
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          ...corsHeaders,
        },
      });
    } else {
      const id = nanoid(8);

      const mime = request.headers.get("content-type");
      const ext = getFileExtension(request.headers.get("x-file-name"));

      await db.put(id, request.body, {
        metadata: { mime, ext },
        expirationTtl,
      });

      return new Response(`{"url":"https://${requestURL.hostname}/${id}.${ext}"}`, {
        status: 200,
        headers: {
          "content-type": "application/json;charset=UTF-8",
          ...corsHeaders,
        },
      });
    }
  },
  "/manifest": async function (request, requestURL) {
    const manifest = {
      Version: "1.0.0",
      Name: `${requestURL.hostname} Uploader`,
      DestinationType: "ImageUploader, FileUploader",
      RequestMethod: "POST",
      RequestURL: `https://${requestURL.hostname}/upload`,
      Headers: {
        authorization: "INSERT_AUTH_KEY_HERE",
        "x-file-name": "$filename$",
      },
      Body: "Binary",
      URL: "$json:url$",
      ThumbnailURL: "$json:url$",
    };

    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        "content-type": "application/json;charset=UTF-8",
        ...corsHeaders,
      },
    });
  },
};

async function handleRequest(request) {
  const requestURL = new URL(request.url);

  const fileKey = removeFileExtension(requestURL.pathname.replace("/", ""));

  if (!fileKey)
    return new Response(DEFAULT_ERROR_MESSAGE, {
      status: 404,
      headers: {
        "content-type": "text/html;charset=UTF-8",
        ...corsHeaders,
      },
    });

  const file = await db.getWithMetadata(fileKey, { type: "stream" });

  if (file.value) {
    return new Response(file.value, {
      status: 200,
      headers: {
        "content-type": file.metadata.mime || "application/octet-stream",
        ...corsHeaders,
      },
    });
  } else if (routes[requestURL.pathname]) {
    return await routes[requestURL.pathname](request, requestURL);
  } else {
    return new Response(DEFAULT_ERROR_MESSAGE, {
      status: 404,
      headers: {
        "content-type": "text/html;charset=UTF-8",
        ...corsHeaders,
      },
    });
  }
}

function weeksToSeconds(weeks) {
  return weeks * 7 * 24 * 60 * 60;
}

function getFileExtension(fname) {
  return fname.slice(((fname.lastIndexOf(".") - 1) >>> 0) + 2);
}

function removeFileExtension(fname) {
  return fname.substring(0, fname.lastIndexOf(".") >>> 0);
}

// prettier-ignore
function nanoid(t=21){let n="",r=crypto.getRandomValues(new Uint8Array(t));for(;t--;){let e=63&r[t];n+=e<36?e.toString(36):e<62?(e-26).toString(36).toUpperCase():e<63?"_":"-"}return n}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});


// // nanoid license
// The MIT License (MIT)

// Copyright 2017 Andrey Sitnik <andrey@sitnik.ru>

// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
