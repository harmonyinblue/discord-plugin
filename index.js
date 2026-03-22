(function (exports, components, plugin, storage, assets, metro, patcher) {
    "use strict";
    const { ScrollView, Text, View, TextInput } = components.General;
    const { FormRow, FormIcon, FormDivider, FormSwitchRow } = components.Forms;
    const RowManager = metro.findByName("RowManager");
    let _u = [];

    storage.storage.rules ??= JSON.stringify([]);
    storage.storage.enabled ??= true;
    storage.storage.authToken ??= "";
    storage.storage.redirectEnabled ??= false;
    storage.storage.redirectSource ??= "";
    storage.storage.redirectTarget ??= "";
    storage.storage.nameTargetId ??= "";
    storage.storage.nameAlias ??= "";
    storage.storage.decoTargetId ??= "";
    storage.storage.decoAsset ??= "";
    storage.storage.decoSkuId ??= "";

    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    function rules() {
        return JSON.parse(storage.storage.rules || "[]").map(function (r) {
            try {
                if (!r.find) return null;
                return { re: new RegExp(r.regex ? r.find : esc(r.find), r.ci ? "gi" : "g"), to: r.replace || "" };
            } catch (e) { return null; }
        }).filter(Boolean);
    }

    function fetchUser(id) {
        var tok = (storage.storage.authToken || "").trim();
        if (!tok) return Promise.reject(new Error("No auth token set."));
        if (!id || !id.trim()) return Promise.reject(new Error("No user ID provided."));
        return fetch("https://discord.com/api/v10/users/" + id.trim(), { headers: { Authorization: tok } })
            .then(function (res) {
                if (res.ok) return res.json();
                return res.json().catch(function () { return {}; }).then(function (e) {
                    throw new Error("API error " + res.status + ": " + (e.message || res.statusText));
                });
            });
    }

    function upsert(find, replace) {
        if (!find) return;
        var rs = JSON.parse(storage.storage.rules || "[]");
        var i = rs.findIndex(function (r) { return r.find === find; });
        if (i >= 0) rs[i].replace = replace;
        else rs.push({ find: find, replace: replace, regex: false, ci: false });
        storage.storage.rules = JSON.stringify(rs);
    }

    function del(find) {
        if (!find) return;
        var rs = JSON.parse(storage.storage.rules || "[]");
        storage.storage.rules = JSON.stringify(rs.filter(function (r) { return r.find !== find; }));
    }

    var S = {
        page: { flex: 1, backgroundColor: "#1e1f22" },
        sec: { marginTop: 16, marginBottom: 4, marginHorizontal: 16, fontSize: 12, fontWeight: "600", color: "#8e9297" },
        card: { backgroundColor: "#2b2d31", marginHorizontal: 12, marginBottom: 4, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 12 },
        lbl: { fontSize: 13, color: "#8e9297", marginTop: 12, marginBottom: 2 },
        inp: { backgroundColor: "#1e1f22", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, color: "#dbdee1", fontSize: 15, marginTop: 4 },
        box: { backgroundColor: "#1e1f22", borderRadius: 6, padding: 12, marginTop: 10 },
        irow: { flexDirection: "row", marginBottom: 4 },
        ikey: { color: "#8e9297", fontSize: 12, width: 110 },
        ival: { color: "#dbdee1", fontSize: 12, flex: 1 },
        div: { height: 1, backgroundColor: "#1e1f22", marginVertical: 8 },
        blue: { marginTop: 12, backgroundColor: "#5865f2", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        green: { marginTop: 8, backgroundColor: "#23a55a", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        red: { marginTop: 8, backgroundColor: "#f23f43", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        grey: { marginTop: 8, backgroundColor: "#4e5058", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        btxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
    };

    function Btn(p) {
        return React.createElement(View, { style: p.style },
            React.createElement(Text, { style: S.btxt, onPress: p.onPress, suppressHighlighting: true }, p.label));
    }

    function IRow(p) {
        if (!p.value || p.value === "N/A") return null;
        return React.createElement(View, { style: S.irow },
            React.createElement(Text, { style: S.ikey }, p.label),
            React.createElement(Text, { style: S.ival }, String(p.value)));
    }

    function SubPage(p) {
        return React.createElement(View, { style: S.page },
            React.createElement(View, { style: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#2b2d31" } },
                React.createElement(Text, { style: { color: "#5865f2", fontSize: 16, fontWeight: "600", marginRight: 16 }, onPress: p.onBack, suppressHighlighting: true }, "\u2039 Back"),
                React.createElement(Text, { style: { color: "#dbdee1", fontSize: 17, fontWeight: "700", flex: 1 } }, p.title)),
            React.createElement(p.Page, null));
    }

    function TokenPage() {
        storage.useProxy(storage.storage);
        var ds = React.useState(storage.storage.authToken || ""); var draft = ds[0]; var setDraft = ds[1];
        var ts = React.useState(false); var testing = ts[0]; var setTesting = ts[1];
        var rs = React.useState(null); var result = rs[0]; var setResult = rs[1];
        function save() { storage.storage.authToken = draft.trim(); alert("Token saved."); }
        function test() {
            setTesting(true); setResult(null);
            fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: draft.trim() } })
                .then(function (r) { setResult(r.ok ? "ok" : "fail"); setTesting(false); })
                .catch(function () { setResult("fail"); setTesting(false); });
        }
        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.sec }, "Auth Token"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: { color: "#8e9297", fontSize: 13, lineHeight: 18, marginBottom: 8 } }, "Enter your Discord user token. Never leaves your device."),
                React.createElement(TextInput, { placeholder: "Your token\u2026", placeholderTextColor: "#4e5058", value: draft, onChangeText: setDraft, secureTextEntry: true, autoCapitalize: "none", autoCorrect: false, style: S.inp }),
                result !== null && React.createElement(View, { style: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8, backgroundColor: result === "ok" ? "#23a55a" : "#f23f43" } },
                    React.createElement(Text, { style: { color: "#fff", fontSize: 12, fontWeight: "600" } }, result === "ok" ? "\u2713 Token valid" : "\u2717 Invalid")),
                React.createElement(View, { style: { flexDirection: "row", gap: 8, marginTop: 12 } },
                    React.createElement(View, { style: { flex: 1 } }, React.createElement(Btn, { label: testing ? "Testing\u2026" : "Test Token", onPress: test, style: S.blue })),
                    React.createElement(View, { style: { flex: 1 } }, React.createElement(Btn, { label: "Save", onPress: save, style: S.green })))),
            React.createElement(Text, { style: S.sec }, "How to get your token"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: { color: "#8e9297", fontSize: 13, lineHeight: 20 } }, "1. Open Discord on desktop\n2. Press Ctrl+Shift+I\n3. Go to Network tab\n4. Send any message\n5. Find the 'Authorization' header\n\n\u26a0\ufe0f Never share your token.")),
            React.createElement(View, { style: { height: 40 } }));
    }

    function RedirectorPage() {
        storage.useProxy(storage.storage);
        var s1 = React.useState(storage.storage.redirectSource || ""); var srcId = s1[0]; var setSrcId = s1[1];
        var s2 = React.useState(storage.storage.redirectTarget || ""); var tgtId = s2[0]; var setTgtId = s2[1];
        var s3 = React.useState(false); var fetching = s3[0]; var setFetching = s3[1];
        var s4 = React.useState(null); var tgtData = s4[0]; var setTgtData = s4[1];
        var UserStore = metro.findByStoreName("UserStore");
        function getMyId() {
            try { var me = UserStore.getCurrentUser(); if (me && me.id) { setSrcId(me.id); storage.storage.redirectSource = me.id; } }
            catch (e) { alert("Could not get user ID."); }
        }
        function doFetch() {
            setFetching(true); setTgtData(null);
            fetchUser(tgtId).then(function (d) { setTgtData(d); storage.storage.redirectTarget = tgtId.trim(); setFetching(false); })
                .catch(function (e) { alert(e.message); setFetching(false); });
        }
        function apply() {
            var src = srcId.trim(); var tgt = tgtId.trim();
            if (!src || !tgt) { alert("Both IDs required."); return; }
            upsert(src, tgt);
            if (tgtData) {
                if (tgtData.avatar) upsert(src + "/avatar", tgt + "/avatar");
                var deco = tgtData.avatar_decoration_data;
                if (deco && deco.asset) upsert(src + "/" + deco.asset, tgt + "/" + deco.asset);
                var np = tgtData.collectibles && tgtData.collectibles.nameplate;
                if (np && np.asset) {
                    var pts = np.asset.replace("nameplates/", "").replace(/\/$/, "").split("/");
                    upsert(src + "$" + (pts[0] || "") + "$" + (pts[1] || "") + "$" + (np.palette || ""), "");
                }
                if (tgtData.clan && tgtData.clan.tag) upsert("__redir_clan_" + src, tgtData.clan.tag);
            }
            storage.storage.redirectSource = src; storage.storage.redirectTarget = tgt; storage.storage.redirectEnabled = true;
            alert("Redirect applied!");
        }
        function clear() { del(srcId.trim()); storage.storage.redirectEnabled = false; setTgtData(null); alert("Cleared."); }
        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.sec }, "Configuration"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: S.lbl }, "Source User ID (Redirect FROM)"),
                React.createElement(TextInput, { placeholder: "Your user ID\u2026", placeholderTextColor: "#4e5058", value: srcId, onChangeText: setSrcId, keyboardType: "numeric", style: S.inp }),
                React.createElement(Text, { style: S.lbl }, "Target User ID (Redirect TO)"),
                React.createElement(TextInput, { placeholder: "Target user ID\u2026", placeholderTextColor: "#4e5058", value: tgtId, onChangeText: setTgtId, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: fetching ? "Fetching\u2026" : "Fetch Target User Data", onPress: doFetch, style: S.blue }),
                tgtData && React.createElement(View, { style: S.box },
                    React.createElement(IRow, { label: "Username", value: tgtData.username }),
                    React.createElement(IRow, { label: "Global Name", value: tgtData.global_name }),
                    React.createElement(IRow, { label: "Avatar", value: tgtData.avatar }),
                    React.createElement(IRow, { label: "Decoration", value: tgtData.avatar_decoration_data && tgtData.avatar_decoration_data.asset }),
                    React.createElement(IRow, { label: "Nameplate", value: tgtData.collectibles && tgtData.collectibles.nameplate && tgtData.collectibles.nameplate.asset }),
                    React.createElement(IRow, { label: "Clan Tag", value: tgtData.clan && tgtData.clan.tag }),
                    React.createElement(IRow, { label: "Clan ID", value: tgtData.clan && tgtData.clan.identity_guild_id }))),
            React.createElement(Text, { style: S.sec }, "Status"),
            React.createElement(View, { style: S.card },
                React.createElement(FormSwitchRow, { label: "Enable Redirect", value: storage.storage.redirectEnabled, onValueChange: function (v) { storage.storage.redirectEnabled = v; }, style: { backgroundColor: "transparent", paddingHorizontal: 0 } })),
            React.createElement(Text, { style: S.sec }, "Actions"),
            React.createElement(View, { style: S.card },
                React.createElement(Btn, { label: "Get My ID (Sets Source ID)", onPress: getMyId, style: S.grey }),
                React.createElement(Btn, { label: "Apply Redirect", onPress: apply, style: S.green }),
                React.createElement(Btn, { label: "Clear Redirect", onPress: clear, style: S.red })),
            React.createElement(View, { style: { height: 40 } }));
    }

    function NameChangerPage() {
        storage.useProxy(storage.storage);
        var s1 = React.useState(storage.storage.nameTargetId || ""); var tgtId = s1[0]; var setTgtId = s1[1];
        var s2 = React.useState(storage.storage.nameAlias || ""); var alias = s2[0]; var setAlias = s2[1];
        var s3 = React.useState(false); var fetching = s3[0]; var setFetching = s3[1];
        var s4 = React.useState(null); var userData = s4[0]; var setUserData = s4[1];
        function doFetch() {
            setFetching(true); setUserData(null);
            fetchUser(tgtId).then(function (d) {
                setUserData(d);
                if (!alias) setAlias(d.global_name || d.username || "");
                setFetching(false);
            }).catch(function (e) { alert(e.message); setFetching(false); });
        }
        function save() {
            var id = tgtId.trim(); var name = alias.trim();
            if (!id || !name) { alert("ID and name required."); return; }
            upsert("__nc_global_" + id, name); upsert("__nc_user_" + id, name);
            storage.storage.nameTargetId = id; storage.storage.nameAlias = name;
            alert("Alias \"" + name + "\" saved.");
        }
        function clear() {
            var id = tgtId.trim();
            del("__nc_global_" + id); del("__nc_user_" + id);
            setAlias(""); storage.storage.nameAlias = ""; alert("Alias cleared.");
        }
        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.sec }, "Alias Settings"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: S.lbl }, "Target User ID"),
                React.createElement(TextInput, { placeholder: "User ID to rename\u2026", placeholderTextColor: "#4e5058", value: tgtId, onChangeText: function (v) { setTgtId(v); storage.storage.nameTargetId = v; }, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: fetching ? "Fetching\u2026" : "Look Up User", onPress: doFetch, style: S.blue }),
                userData && React.createElement(View, { style: S.box },
                    React.createElement(IRow, { label: "Username", value: userData.username }),
                    React.createElement(IRow, { label: "Global Name", value: userData.global_name }),
                    React.createElement(IRow, { label: "Decoration", value: userData.avatar_decoration_data && userData.avatar_decoration_data.asset }),
                    React.createElement(IRow, { label: "Nameplate", value: userData.collectibles && userData.collectibles.nameplate && userData.collectibles.nameplate.asset }),
                    React.createElement(IRow, { label: "Clan Tag", value: userData.clan && userData.clan.tag })),
                React.createElement(View, { style: S.div }),
                React.createElement(Text, { style: S.lbl }, "New Name (Alias)"),
                React.createElement(TextInput, { placeholder: "Display name to show instead\u2026", placeholderTextColor: "#4e5058", value: alias, onChangeText: setAlias, style: S.inp }),
                React.createElement(Btn, { label: "Save Alias", onPress: save, style: S.green }),
                React.createElement(Btn, { label: "Clear Alias", onPress: clear, style: S.red })),
            React.createElement(View, { style: { height: 40 } }));
    }

    function DecorationChangerPage() {
        storage.useProxy(storage.storage);
        var s1 = React.useState(storage.storage.decoTargetId || ""); var tgtId = s1[0]; var setTgtId = s1[1];
        var s2 = React.useState(storage.storage.decoAsset || ""); var assetId = s2[0]; var setAssetId = s2[1];
        var s3 = React.useState(storage.storage.decoSkuId || ""); var skuId = s3[0]; var setSkuId = s3[1];
        var s4 = React.useState(false); var fetching = s4[0]; var setFetching = s4[1];
        var s5 = React.useState(null); var userData = s5[0]; var setUserData = s5[1];
        function doFetch() {
            setFetching(true); setUserData(null);
            fetchUser(tgtId).then(function (d) {
                setUserData(d);
                var deco = d.avatar_decoration_data;
                if (deco) { if (!assetId) setAssetId(deco.asset || ""); if (!skuId) setSkuId(String(deco.sku_id || "")); }
                setFetching(false);
            }).catch(function (e) { alert(e.message); setFetching(false); });
        }
        function save() {
            var id = tgtId.trim(); var asset = assetId.trim();
            if (!id || !asset) { alert("ID and asset required."); return; }
            upsert(id + "/" + asset, id + "/" + asset);
            storage.storage.decoTargetId = id; storage.storage.decoAsset = asset; storage.storage.decoSkuId = skuId.trim();
            alert("Decoration saved.");
        }
        function clear() {
            var id = tgtId.trim(); var asset = assetId.trim();
            del(id + "/" + asset); setAssetId(""); setSkuId("");
            storage.storage.decoAsset = ""; storage.storage.decoSkuId = ""; alert("Cleared.");
        }
        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.sec }, "Decoration Settings"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: S.lbl }, "Target User ID"),
                React.createElement(TextInput, { placeholder: "User ID\u2026", placeholderTextColor: "#4e5058", value: tgtId, onChangeText: function (v) { setTgtId(v); storage.storage.decoTargetId = v; }, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: fetching ? "Fetching\u2026" : "Fetch User Decoration", onPress: doFetch, style: S.blue }),
                userData && React.createElement(View, { style: S.box },
                    React.createElement(IRow, { label: "Username", value: userData.username }),
                    React.createElement(IRow, { label: "Asset", value: userData.avatar_decoration_data && userData.avatar_decoration_data.asset }),
                    React.createElement(IRow, { label: "SKU ID", value: userData.avatar_decoration_data && String(userData.avatar_decoration_data.sku_id || "") }),
                    React.createElement(IRow, { label: "Nameplate", value: userData.collectibles && userData.collectibles.nameplate && userData.collectibles.nameplate.asset }),
                    React.createElement(IRow, { label: "Palette", value: userData.collectibles && userData.collectibles.nameplate && userData.collectibles.nameplate.palette })),
                React.createElement(View, { style: S.div }),
                React.createElement(Text, { style: S.lbl }, "Asset ID"),
                React.createElement(TextInput, { placeholder: "a_1ffd338bf104b616ea\u2026", placeholderTextColor: "#4e5058", value: assetId, onChangeText: setAssetId, autoCapitalize: "none", style: S.inp }),
                React.createElement(Text, { style: S.lbl }, "SKU ID"),
                React.createElement(TextInput, { placeholder: "1385050947834613820", placeholderTextColor: "#4e5058", value: skuId, onChangeText: setSkuId, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: "Save Decoration", onPress: save, style: S.green }),
                React.createElement(Btn, { label: "Clear Decoration", onPress: clear, style: S.red })),
            React.createElement(View, { style: { height: 40 } }));
    }

    function NavCard(p) {
        return React.createElement(View, { style: { backgroundColor: "#2b2d31", marginHorizontal: 12, marginBottom: 4, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" } },
            React.createElement(View, { style: { flex: 1 } },
                React.createElement(Text, { style: { color: "#dbdee1", fontSize: 15, fontWeight: "600" } }, p.label),
                p.sub && React.createElement(Text, { style: { color: "#8e9297", fontSize: 12, marginTop: 2 } }, p.sub)),
            p.badge && React.createElement(View, { style: { backgroundColor: "#23a55a", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 10 } },
                React.createElement(Text, { style: { color: "#fff", fontSize: 11, fontWeight: "700" } }, p.badge)),
            React.createElement(Text, { style: { color: "#5865f2", fontSize: 20, fontWeight: "600" }, onPress: p.onPress, suppressHighlighting: true }, "\u203a"));
    }

    function SubPage(p) {
        return React.createElement(View, { style: S.page },
            React.createElement(View, { style: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#2b2d31" } },
                React.createElement(Text, { style: { color: "#5865f2", fontSize: 16, fontWeight: "600", marginRight: 16 }, onPress: p.onBack, suppressHighlighting: true }, "\u2039 Back"),
                React.createElement(Text, { style: { color: "#dbdee1", fontSize: 17, fontWeight: "700", flex: 1 } }, p.title)),
            React.createElement(p.Page, null));
    }

    function SettingsPage() {
        storage.useProxy(storage.storage);
        var ps = React.useState("home"); var page = ps[0]; var setPage = ps[1];
        if (page === "token") return React.createElement(SubPage, { title: "Auth Token", onBack: function () { setPage("home"); }, Page: TokenPage });
        if (page === "redirector") return React.createElement(SubPage, { title: "Dynamic Profile Redirector", onBack: function () { setPage("home"); }, Page: RedirectorPage });
        if (page === "name") return React.createElement(SubPage, { title: "Name Changer", onBack: function () { setPage("home"); }, Page: NameChangerPage });
        if (page === "deco") return React.createElement(SubPage, { title: "Decoration Changer", onBack: function () { setPage("home"); }, Page: DecorationChangerPage });
        var tokenSet = !!(storage.storage.authToken || "").trim();
        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.sec }, "Global"),
            React.createElement(View, { style: S.card },
                React.createElement(FormSwitchRow, { label: "Enable all replacements", value: storage.storage.enabled, onValueChange: function (v) { storage.storage.enabled = v; }, style: { backgroundColor: "transparent", paddingHorizontal: 0 } })),
            React.createElement(Text, { style: S.sec }, "Setup"),
            React.createElement(View, { style: { backgroundColor: "#2b2d31", marginHorizontal: 12, marginBottom: 4, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" } },
                React.createElement(View, null,
                    React.createElement(Text, { style: { color: "#dbdee1", fontSize: 15, fontWeight: "600" } }, "Auth Token"),
                    React.createElement(Text, { style: { color: tokenSet ? "#23a55a" : "#f23f43", fontSize: 12, marginTop: 2 } }, tokenSet ? "Token configured" : "Not set \u2014 required for API lookups")),
                React.createElement(Text, { style: { color: "#5865f2", fontSize: 14, fontWeight: "600" }, onPress: function () { setPage("token"); }, suppressHighlighting: true }, "Configure \u203a")),
            React.createElement(Text, { style: S.sec }, "Features"),
            NavCard({ label: "Dynamic Profile Redirector", sub: "Redirect one user's profile to another", badge: storage.storage.redirectEnabled ? "ON" : null, onPress: function () { setPage("redirector"); } }),
            NavCard({ label: "Name Changer", sub: "Assign a local alias to any user", badge: storage.storage.nameAlias || null, onPress: function () { setPage("name"); } }),
            NavCard({ label: "Decoration Changer", sub: "Override a user's avatar decoration", badge: storage.storage.decoAsset ? "SET" : null, onPress: function () { setPage("deco"); } }),
            React.createElement(View, { style: { height: 40 } }));
    }

    function applyPatches() {
        var UPI = metro.findByName("UserProfilePrimaryInfo", false);
        var UAB = metro.findByName("UserProfileAboutMeCard", false);
        var CVW = metro.findByName("ChatViewWrapperBase", false);
        var US = metro.findByStoreName("UserStore");

        _u.push(patcher.after("getUser", US, function (args, user) {
            if (!storage.storage.enabled) return;
            var uid = args[0];
            rules().forEach(function (rule) {
                var src = rule.re.source.replace(/\\\\/g, "\\").replace(/\\/g, "");
                var ap = src.split("/"); if (ap.length > 1 && ap[0] === uid) user.avatarDecorationData = { asset: ap[1], skuId: undefined, expiresAt: null };
                var sp = src.split("%"); if (sp.length > 1 && sp[0] === uid) user.displayNameStyles = { fontId: sp[1], effectId: sp[2], colors: sp.slice(3) };
                var cp = src.split("$"); if (cp.length > 1 && cp[0] === uid) user.collectibles = { nameplate: { asset: "nameplates/" + cp[1] + "/" + cp[2] + "/", skuId: undefined, expiresAt: null, label: undefined, palette: cp[3] } };
                if (user && user.primaryGuild && user.primaryGuild.tag) user.primaryGuild.tag = user.primaryGuild.tag.replace(rule.re, rule.to);
            });
        }));

        _u.push(patcher.before("generate", RowManager.prototype, function (args) {
            if (!storage.storage.enabled) return;
            try {
                var row = args[0]; var msg = row && row.message; var au = msg && msg.author;
                rules().forEach(function (rule) {
                    if (msg && msg.content) msg.content = msg.content.replace(rule.re, rule.to);
                    if (au && au.id) au.id = au.id.replace(rule.re, rule.to);
                    if (au && au.avatar) au.avatar = au.avatar.replace(rule.re, rule.to);
                    if (au && au.avatarDecorationData && au.avatarDecorationData.asset) au.avatarDecorationData.asset = au.avatarDecorationData.asset.replace(rule.re, rule.to);
                    if (au && au.primaryGuild && au.primaryGuild.tag) au.primaryGuild.tag = au.primaryGuild.tag.replace(rule.re, rule.to);
                    if (au && au.primaryGuild && au.primaryGuild.badge) au.primaryGuild.badge = au.primaryGuild.badge.replace(rule.re, rule.to);
                    if (au && au.primaryGuild && au.primaryGuild.identityGuildId) au.primaryGuild.identityGuildId = au.primaryGuild.identityGuildId.replace(rule.re, rule.to);
                    if (au && au.username) au.username = au.username.replace(rule.re, rule.to);
                    if (au && au.globalName) au.globalName = au.globalName.replace(rule.re, rule.to);
                    if (msg && msg.attachments && msg.attachments.length) msg.attachments.forEach(function (a) { if (a.url && a.url.match(rule.re)) { a.url = rule.to; a.proxy_url = rule.to; } });
                });
            } catch (e) { }
        }));

        _u.push(patcher.after("default", UPI, function (_a, res) {
            if (!storage.storage.enabled) return;
            try { rules().forEach(function (rule) { var t = res && res.props && res.props.children[1] && res.props.children[1].props && res.props.children[1].props.children[0] && res.props.children[1].props.children[0].props && res.props.children[1].props.children[0].props.userTag; if (t) res.props.children[1].props.children[0].props.userTag = t.replace(rule.re, rule.to); }); } catch (e) { }
        }));

        _u.push(patcher.after("default", UAB, function (_a, res) {
            if (!storage.storage.enabled) return;
            try { rules().forEach(function (rule) { var u = res && res.props && res.props.children[1] && res.props.children[1].props && res.props.children[1].props.userId; if (u) res.props.children[1].props.userId = u.replace(rule.re, rule.to); }); } catch (e) { }
        }));

        _u.push(patcher.after("default", CVW, function (_a, res) {
            if (!storage.storage.enabled) return;
            try { var recs = res.props.children.props.children.filter(Boolean)[0].props.children.props.channel.recipients; rules().forEach(function (rule) { recs.forEach(function (id, i) { recs[i] = id.replace(rule.re, rule.to); }); }); } catch (e) { }
        }));
    }

    exports.default = {
        settings: function () { return React.createElement(SettingsPage, null); },
        onLoad: function () { setTimeout(function () { applyPatches(); }, 0); },
        onUnload: function () { _u.forEach(function (f) { if (f) f(); }); _u = []; },
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    return exports;
})(
    {},
    vendetta.ui.components,
    vendetta.plugin,
    vendetta.storage,
    vendetta.ui.assets,
    vendetta.metro,
    vendetta.patcher
);