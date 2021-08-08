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
  "/dashboard": async function (request, requestURL) {
    return new Response(
      '<!DOCTYPE html><html><head><title>Your Files</title><style>*{box-sizing:border-box}html,body{background-color:#1e1e1e;font-family:sans-serif;color:#d4d4d4;width:100%;height:100%;margin:0;padding:0}h1{padding-top:15px;margin:0;text-align:center}ul{list-style-type:none;display:flex;flex-wrap:wrap;padding:0 0 0 0px;justify-content:center}li{padding:12px 6px 0px;transition:opacity 500ms ease-out}figure{border:thin #c0c0c0 solid;display:flex;flex-flow:column;padding:5px;width:220px;height:200px;margin:auto;opacity:1}img{width:100%;height:100%;object-fit:contain;background-color:black}form{text-align:center}figcaption{background-color:#4752c4;color:#fff;font:italic smaller sans-serif;padding:3px;text-align:center}figure button{background-color:#ed4245}button{border:0;background-color:#4752c4;height:25px;color:rgb(255, 255, 255);text-align:center;transition:all 200ms ease-out}figure button:hover{background-color:#dd1c1f}.collapse{opacity:0}@media only screen and (max-width: 700px){li,figure{width:100%}.expanded{padding:0px !important}}.expanded{position:fixed;top:0;left:0;right:0;bottom:0;z-index:1002;animation:pop 200ms ease;padding:4%}.noscroll{overflow:hidden}</style> <script>window.addEventListener("DOMContentLoaded",(event)=>{const upkey=prompt("Enter key to view dashboard.");const ul=document.querySelector("ul");const template=document.getElementById("listItemTemplate");let cursor;async function loadItems(){const req=await fetch("/dashboard/list",{headers:{authorization:upkey}});const res=await req.json();const frag=document.createDocumentFragment();for(const key of res.keys){const clone=template.content.cloneNode(true);const li=clone.querySelector("li");const img=li.querySelector("img");const figcaption=li.querySelector("figcaption");const button=li.querySelector("button");img.src=`/${key.name}.${key.metadata.ext}`;figcaption.textContent=`${key.name}.${key.metadata.ext}`;li.setAttribute("data-key",key.name);button.setAttribute("data-key",key.name);frag.appendChild(li);} ul.appendChild(frag);} loadItems();ul.addEventListener("click",(e)=>{if(e.target.matches("li figure button")){const parent=document.querySelector(`li[data-key="${e.target.attributes["data-key"].value}"]`);parent.classList.toggle("collapse");parent.addEventListener("transitionend",async()=>{const req=await fetch(`/dashboard/delete?key=${e.target.attributes["data-key"].value}`,{method:"POST",headers:{authorization:upkey}});const res=await req.json();if(res.ok==="yeah")parent.remove();else parent.classList.toggle("collapse");},{once:true});} if(e.target.matches("li figure img")){e.target.classList.toggle("expanded");document.body.classList.toggle("noscroll");}});},{once:true});</script> </head> <header><h1>Your Files</h1> </header><body> <main><ul></ul> </main> <template id="listItemTemplate"><li> <figure> <img /> <figcaption></figcaption> <button>delete</button> </figure></li> </template></body></html>',
      {
        status: 200,
        headers: {
          "content-type": "text/html;charset=UTF-8",
          ...corsHeaders,
        },
      }
    );
  },
  "/dashboard/list": async function (request, requestURL) { 
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
      const cursor = requestURL.searchParams.get("cursor") || null;
      const limit = requestURL.searchParams.get("limit") || 100;

      const list = await db.list({ cursor, limit });

      return new Response(JSON.stringify(list), {
        status: 200,
        headers: {
          "content-type": "application/json;charset=UTF-8",
          ...corsHeaders,
        },
      });
    }
  },
  "/dashboard/delete": async function (request, requestURL) {
    const authKey = request.headers.get("authorization");
    if (authKey !== UPLOAD_KEY) {
      return new Response("Invalid Credentials", {
        status: 403,
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          ...corsHeaders,
        },
      });
    } else if (request.method !== "POST") {
      return new Response("Invalid", {
        status: 403,
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          ...corsHeaders,
        },
      });
    } else {
      const key = requestURL.searchParams.get("key");

      await db.delete(key);

      return new Response(`{"ok":"yeah"}`, {
        status: 200,
        headers: {
          "content-type": "application/json;charset=UTF-8",
          ...corsHeaders,
        },
      });
    }
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
