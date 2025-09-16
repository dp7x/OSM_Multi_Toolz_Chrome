// --- Localization ---
async function loadLocale() {
    let lang = navigator.language.slice(0, 2).toLowerCase(); 
    if (!['it','en','sk'].includes(lang)) lang = 'en'; // 3 languages to start, english default
    const res = await fetch(`LOCALES/${lang}.json`);
    return await res.json();
}

document.addEventListener('DOMContentLoaded', async () => {
    const L = await loadLocale();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);

    const changesetInput = document.getElementById('changesetInput');
    const detailsDiv = document.getElementById('details');
    const alertsDiv = document.getElementById('alerts');
    const changesetIdSpan = document.getElementById('changesetId');

    // --- Update localized texts ---
    document.title = L.extName;
    document.getElementById('headerTitle').textContent = L.extName;
	document.getElementById('headerSubtitle').textContent = L.headerTitle; 
    document.getElementById('changesetLabel').textContent = L.changesetDetected;
    document.getElementById('manualLabel').textContent = L.manualChangeset;
    document.getElementById('osmchaBtn').textContent = L.btn_osmcha;
    document.getElementById('achaviBtn').textContent = L.btn_achavi;
    document.getElementById('osmvizBtn').textContent = L.btn_osmviz;
    document.getElementById('osmoseBtn').textContent = L.btn_osmose;
    document.getElementById('osminspectorBtn').textContent = L.btn_osminspector;
    document.getElementById('mapcompareBtn').textContent = L.btn_mapcompare;
	document.getElementById('losmeBtn').textContent = L.btn_losme;

    // --- Functions ---
    async function resolveChangesetFromObject(type, objId) {
        try {
            const res = await fetch(`https://api.openstreetmap.org/api/0.6/${type}/${objId}`);
            const xmlText = await res.text();
            const xml = new DOMParser().parseFromString(xmlText, "application/xml");
            const el = xml.querySelector(type);
            if (!el) throw new Error("Object not found");
            return el.getAttribute("changeset");
        } catch (err) {
            console.error(`Error getting changeset from ${type}/${objId}`, err);
            return null;
        }
    }

    async function renderChangeset(changesetId) {
        if (!changesetId) return;

        changesetInput.value = changesetId;

        try {
            const response = await fetch(`https://api.openstreetmap.org/api/0.6/changeset/${changesetId}`);
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, "application/xml");
            const cs = xml.querySelector("changeset");
            if (!cs) throw new Error("Changeset not found");

            const commentCount = parseInt(cs.getAttribute("comments_count"), 10) || 0;

            changesetIdSpan.innerHTML = `
                <a href="https://www.openstreetmap.org/changeset/${changesetId}" target="_blank">${changesetId}</a>
                ${commentCount > 0 ? `<a href="https://www.openstreetmap.org/changeset/${changesetId}#comments" target="_blank" style="margin-left: 10px; text-decoration: none; color: inherit;">💬 ${commentCount}</a>` : ''}
            `;

            const user = cs.getAttribute("user");
            const uid = cs.getAttribute("uid");
            const createdAt = new Date(cs.getAttribute("created_at"));
            const createdStr = createdAt.toLocaleString();
            const comment = cs.querySelector('tag[k="comment"]')?.getAttribute("v") || "";
			const editor = cs.querySelector('tag[k="created_by"]')?.getAttribute("v") || "";
            const minlat = parseFloat(cs.getAttribute("min_lat"));
            const maxlat = parseFloat(cs.getAttribute("max_lat"));
            const minlon = parseFloat(cs.getAttribute("min_lon"));
            const maxlon = parseFloat(cs.getAttribute("max_lon"));
            const bboxStr = `${minlat.toFixed(3)}, ${minlon.toFixed(3)}, ${maxlat.toFixed(3)}, ${maxlon.toFixed(3)}`;
            const bboxLink = `https://www.openstreetmap.org/?minlat=${minlat}&minlon=${minlon}&maxlat=${maxlat}&maxlon=${maxlon}`;

            const latDiff = maxlat - minlat;
            const lonDiff = maxlon - minlon;

			// --- helper date format dd/mm/yyyy ---
			function formatDateDMY(dateStr) {
				if (!dateStr) return "—";
				const d = new Date(dateStr);
				const day = d.getDate();
				const month = d.getMonth() + 1;
				const year = d.getFullYear();
				return `${day}/${month}/${year}`;
			}

			// --- Retrieve user info (changeset count, account_created, traces) ---
			let changesetCount = "?";
			let mapperSinceStr = "—";
			let lastEditStr = "—";
			let tracesCount = "0";

			try {
				const userRes = await fetch(`https://api.openstreetmap.org/api/0.6/user/${uid}`);
				const userText = await userRes.text();
				const userDoc = parser.parseFromString(userText, "application/xml");

				// total number of changesets
				changesetCount = userDoc.querySelector("changesets")?.getAttribute("count") || "?";

				// account_created -> Mapper since
				const accountCreated = userDoc.querySelector("user")?.getAttribute("account_created") || "";
				mapperSinceStr = formatDateDMY(accountCreated);

				// GPS traces
				tracesCount = userDoc.querySelector("traces")?.getAttribute("count") || "0";

				// --- last changeset ---
				const changesetsRes = await fetch(`https://api.openstreetmap.org/api/0.6/changesets?user=${uid}`);
				const changesetsXml = await changesetsRes.text();
				const changesetsDoc = parser.parseFromString(changesetsXml, "application/xml");
				const lastChangesetNode = changesetsDoc.querySelector("changeset");
				const lastChangesetDate = lastChangesetNode?.getAttribute("created_at") || "";
				lastEditStr = formatDateDMY(lastChangesetDate);

			} catch (err) {
				console.error("Error getting user info:", err);
			}

            // --- ALERTS ---
            alertsDiv.innerHTML = "";
            if (!comment) alertsDiv.innerHTML += `<p>${L.alertNoComment}</p>`;
            if (latDiff > 1 || lonDiff > 1) alertsDiv.innerHTML += `<p>${L.alertLargeArea}</p>`;
            const changesCount = cs.getAttribute("num_changes") || "?";
            if (!isNaN(changesCount)) {
                if (changesCount < 10) alertsDiv.innerHTML += `<p>${L.alertSmallChangeset}</p>`;
                else if (changesCount > 5000) alertsDiv.innerHTML += `<p>${L.alertHugeChangeset}</p>`;
            }

            const now = new Date();
            const ageYears = (now - createdAt) / (1000*60*60*24*365);
            let tooOld = false;
            let dateHtml = `<p><b>${L.changesetDate}:</b> ${createdStr}</p>`;
            if (ageYears > 2) {
                alertsDiv.innerHTML += `<p>${L.alertOldChangeset}</p>`;
                tooOld = true;
                dateHtml = `<p style="color:orange;"><b>${L.changesetDate}:</b> ${createdStr}</p>`;
            }
			
			// translate comment
			const userLang = navigator.language.split('-')[0] || 'en'; //browser language
			const encodedComment = encodeURIComponent(comment || "");
			const translateLink = `https://translate.google.com/?sl=auto&tl=${userLang}&text=${encodedComment}`;


            // --- HTML CONSTRUCTION DETAILS ---
			let html = `
			<p><b>${L.user}:</b> ${user} (<strong>${changesetCount}</strong>)
				<a href="https://www.openstreetmap.org/user/${encodeURIComponent(user)}" target="_blank">${L.osmProfile}</a> |
				<a href="https://hdyc.neis-one.org/?${encodeURIComponent(user)}" target="_blank">${L.hdyc}</a> |
				<a href="https://www.openstreetmap.org/messages/new/${encodeURIComponent(user)}" target="_blank">${L.message}</a>
			</p>

			<!-- Icons -->
			<p style="margin:4px 0 8px 0; font-size:90%;"><center>
				<span title="${L.mapperSince}">⏳ ${mapperSinceStr}</span> &nbsp;|&nbsp;
				<span title="${L.lastEdit}">🕒 ${lastEditStr}</span> &nbsp;|&nbsp;
				<span title="${L.traces}">🛰️ ${tracesCount}</span>
				</center>
			</p>

			<p>
			  <b>${L.comment}:</b> ${comment || L.missingComment} 
			  ${comment ? `<a href="${translateLink}" target="_blank" title="Translate comment">🌐</a>` : ''}
			</p>

			<p><b>${L.editor || "Editor"}:</b> ${editor || L.missingEditor || "-"}</p>

			${dateHtml}

			<p><b>${L.bbox}:</b>
				<a href="${bboxLink}" target="_blank">${bboxStr}</a>
				<a href="#" id="copyBbox" style="margin-left:8px; font-size:90%;">📋 ${L.copy}</a>
			</p>
			`;

            detailsDiv.innerHTML = html;

            document.getElementById('copyBbox').addEventListener('click', (e) => {
                e.preventDefault();
                navigator.clipboard.writeText(bboxStr).then(() => {
                    e.target.textContent = `✅ ${L.copied}`;
                    setTimeout(() => e.target.textContent = `📋 ${L.copy}`, 1500);
                });
            });

            const expandFactor = 0.2;
            const latMargin = latDiff * expandFactor || 0.05;
            const lonMargin = lonDiff * expandFactor || 0.05;
            const bbox = [minlon - lonMargin, minlat - latMargin, maxlon + lonMargin, maxlat + latMargin].join(",");
            const centerLat = (minlat + maxlat) / 2;
            const centerLon = (minlon + maxlon) / 2;

            // --- Buttons ---
            const openTab = (link) => chrome.tabs.create({ url: link });

            document.getElementById('osmoseBtn').onclick = () => {
                if(tooOld) alert(L.alertOldChangeset);
                const link = `https://osmose.openstreetmap.fr/en/map/#zoom=12&lat=${centerLat}&lon=${centerLon}&bbox=${bbox}&username=${encodeURIComponent(user)}`;
                openTab(link);
            };
            document.getElementById('osmchaBtn').onclick = () => {
                if(tooOld) alert(L.alertOldChangeset);
                openTab(`https://osmcha.org/changesets/${changesetId}`);
            };
            document.getElementById('achaviBtn').onclick = () => {
                if(tooOld) alert(L.alertOldChangeset);
                openTab(`https://overpass-api.de/achavi/?changeset=${changesetId}`);
            };
            document.getElementById('osmvizBtn').onclick = () => {
                if(tooOld) alert(L.alertOldChangeset);
                openTab(`https://resultmaps.neis-one.org/osm-change-viz?c=${changesetId}`);
            };
            document.getElementById('osminspectorBtn').onclick = () => {
                if(tooOld) alert(L.alertOldChangeset);
                openTab(`https://tools.geofabrik.de/osmi/?view=geometry&lon=${centerLon}&lat=${centerLat}&zoom=15&baselayer=Geofabrik%20Standard`);
            };
            document.getElementById('mapcompareBtn').onclick = () => {
                if(tooOld) alert(L.alertOldChangeset);
                openTab(`https://mc.bbbike.org/mc/?lon=${centerLon}&lat=${centerLat}&zoom=15`);
            };
			document.getElementById('losmeBtn').onclick = () => {
				if (tooOld) alert("This changeset is too old, LOSMET may not display it correctly..");
				openTab(`https://resultmaps.neis-one.org/osm-edits-tile/#14/${centerLat}/${centerLon}`);
			};
        } catch (err) {
            alertsDiv.innerHTML = `<p style="color:red">Error getting data</p>`;
            console.error(err);
        }
    }

    // --- Determine changeset from URL ---
    let changesetId = null;
    let match;
    if ((match = url.pathname.match(/^\/changeset\/(\d+)/))) {
        changesetId = match[1];
    } else if ((match = url.pathname.match(/^\/(node|way|relation)\/(\d+)/))) {
        changesetId = await resolveChangesetFromObject(match[1], match[2]);
    }

    if (changesetId) {
        await renderChangeset(changesetId);
    } else {
        changesetIdSpan.textContent = L.changesetDetected + ": --";
    }

    // --- Manual loading button ---
    document.getElementById('loadBtn').addEventListener('click', async () => {
        const manualId = changesetInput.value.trim();
        if (manualId) {
            await renderChangeset(manualId);
        }
    });

});
