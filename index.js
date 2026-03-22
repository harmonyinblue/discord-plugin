(function (exports, components, pluginApi, storage, assets, metro, patcher) {
    "use strict";
    //123
    const { ScrollView, Text, View, TextInput, Switch } = components.General;
    const RowManager = metro.findByName("RowManager");
    let _unpatchers = [];

    const store = pluginApi.storage;

    store.rules ??= JSON.stringify([]);
    store.enabled ??= true;
    store.authToken ??= "";
    store.redirectEnabled ??= false;
    store.redirectSource ??= "";
    store.redirectTarget ??= "";
    store.nameTargetId ??= "";
    store.nameAlias ??= "";
    store.decoTargetId ??= "";
    store.decoAsset ??= "";
    store.decoSkuId ??= "";

    function getToken() {
        var stored = (store.authToken || "").trim();
        if (stored) return stored;
        return null;
    }

    function showToken(tok) {
        if (!tok) return "not set";
        return tok;
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function getCompiledRules() {
        return JSON.parse(store.rules || "[]").map(function (rule) {
            try {
                if (!rule.find) return null;
                return {
                    re: new RegExp(rule.regex ? rule.find : escapeRegex(rule.find), rule.ci ? "gi" : "g"),
                    to: rule.replace != null ? rule.replace : "",
                };
            } catch (e) { return null; }
        }).filter(Boolean);
    }

    function fetchDiscordUser(userId) {
        var token = getToken();
        if (!token) return Promise.reject(new Error("Could not retrieve auth token."));
        if (!userId || !userId.trim()) return Promise.reject(new Error("No User ID provided."));
        return fetch("https://discord.com/api/v10/users/" + userId.trim(), {
            headers: { Authorization: token },
        }).then(function (res) {
            if (res.ok) return res.json();
            return res.json().catch(function () { return {}; }).then(function (err) {
                throw new Error("Discord API error " + res.status + ": " + (err.message || res.statusText));
            });
        });
    }

    function upsertRule(find, replace) {
        if (!find) return;
        var rules = JSON.parse(store.rules || "[]");
        var idx = -1;
        for (var i = 0; i < rules.length; i++) { if (rules[i].find === find) { idx = i; break; } }
        if (idx >= 0) rules[idx].replace = replace;
        else rules.push({ find: find, replace: replace, regex: false, ci: false });
        store.rules = JSON.stringify(rules);
    }

    function removeRule(find) {
        if (!find) return;
        store.rules = JSON.stringify(
            JSON.parse(store.rules || "[]").filter(function (r) { return r.find !== find; })
        );
    }

    var S = {
        page: { flex: 1, backgroundColor: "#1e1f22" },
        section: { marginTop: 16, marginBottom: 4, marginHorizontal: 16, fontSize: 12, fontWeight: "600", color: "#8e9297" },
        card: { backgroundColor: "#2b2d31", marginHorizontal: 12, marginBottom: 4, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 12 },
        lbl: { fontSize: 13, color: "#8e9297", marginTop: 12, marginBottom: 2 },
        inp: { backgroundColor: "#1e1f22", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, color: "#dbdee1", fontSize: 15, marginTop: 4 },
        infoBox: { backgroundColor: "#1e1f22", borderRadius: 6, padding: 12, marginTop: 10 },
        infoRow: { flexDirection: "row", marginBottom: 4 },
        infoKey: { color: "#8e9297", fontSize: 12, width: 110 },
        infoVal: { color: "#dbdee1", fontSize: 12, flex: 1 },
        div: { height: 1, backgroundColor: "#1e1f22", marginVertical: 8 },
        blue: { marginTop: 12, backgroundColor: "#5865f2", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        green: { marginTop: 8, backgroundColor: "#23a55a", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        red: { marginTop: 8, backgroundColor: "#f23f43", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        grey: { marginTop: 8, backgroundColor: "#4e5058", borderRadius: 4, paddingVertical: 10, alignItems: "center" },
        btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
        row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, overflow: "hidden" },
        rowLbl: { color: "#dbdee1", fontSize: 15, flex: 1 },
    };

    function Btn(props) {
        return React.createElement(View, { style: props.style },
            React.createElement(Text, { style: S.btnTxt, onPress: props.onPress, suppressHighlighting: true }, props.label)
        );
    }

    function InfoRow(props) {
        if (!props.value || props.value === "N/A") return null;
        return React.createElement(View, { style: S.infoRow },
            React.createElement(Text, { style: S.infoKey }, props.label),
            React.createElement(Text, { style: S.infoVal }, String(props.value))
        );
    }

    function ToggleRow(props) {
        return React.createElement(View, { style: S.row },
            React.createElement(Text, { style: S.rowLbl }, props.label),
            React.createElement(View, { style: { width: 51, alignItems: "flex-end" } }, React.createElement(Switch, { value: props.value, onValueChange: props.onChange, trackColor: { true: "#5865f2" } }))
        );
    }

    function SubPage(props) {
        return React.createElement(View, { style: S.page },
            React.createElement(View, { style: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#2b2d31" } },
                React.createElement(Text, { style: { color: "#5865f2", fontSize: 16, fontWeight: "600", marginRight: 16 }, onPress: props.onBack, suppressHighlighting: true }, "\u2039 Back"),
                React.createElement(Text, { style: { color: "#dbdee1", fontSize: 17, fontWeight: "700", flex: 1 } }, props.title)
            ),
            React.createElement(props.Page, null)
        );
    }

    function NavCard(props) {
        return React.createElement(View, { style: { backgroundColor: "#2b2d31", marginHorizontal: 12, marginBottom: 4, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" } },
            React.createElement(View, { style: { flex: 1 } },
                React.createElement(Text, { style: { color: "#dbdee1", fontSize: 15, fontWeight: "600" } }, props.label),
                props.sub && React.createElement(Text, { style: { color: "#8e9297", fontSize: 12, marginTop: 2 } }, props.sub)
            ),
            props.badge && React.createElement(View, { style: { backgroundColor: "#23a55a", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 10 } },
                React.createElement(Text, { style: { color: "#fff", fontSize: 11, fontWeight: "700" } }, props.badge)
            ),
            React.createElement(Text, { style: { color: "#5865f2", fontSize: 20, fontWeight: "600" }, onPress: props.onPress, suppressHighlighting: true }, "\u203a")
        );
    }

    function RedirectorPage() {
        storage.useProxy(store);
        var srcState = React.useState(store.redirectSource || ""); var sourceId = srcState[0]; var setSourceId = srcState[1];
        var tgtState = React.useState(store.redirectTarget || ""); var targetId = tgtState[0]; var setTargetId = tgtState[1];
        var fetchingState = React.useState(false); var fetching = fetchingState[0]; var setFetching = fetchingState[1];
        var dataState = React.useState(null); var targetData = dataState[0]; var setTargetData = dataState[1];
        var UserStore = metro.findByStoreName("UserStore");

        function getMyId() {
            try {
                var me = UserStore.getCurrentUser();
                if (me && me.id) { setSourceId(me.id); store.redirectSource = me.id; }
            } catch (e) { alert("Could not read current user ID."); }
        }

        function fetchTarget() {
            setFetching(true); setTargetData(null);
            fetchDiscordUser(targetId).then(function (data) {
                setTargetData(data);
                store.redirectTarget = targetId.trim();
                setFetching(false);
            }).catch(function (e) { alert(e.message); setFetching(false); });
        }

        function applyRedirect() {
            var src = sourceId.trim(); var tgt = targetId.trim();
            if (!src || !tgt) { alert("Both IDs are required."); return; }
            upsertRule(src, tgt);
            if (targetData) {
                if (targetData.avatar) upsertRule(src + "/avatar", tgt + "/avatar");
                var deco = targetData.avatar_decoration_data;
                if (deco && deco.asset) upsertRule(src + "/" + deco.asset, tgt + "/" + deco.asset);
                var np = targetData.collectibles && targetData.collectibles.nameplate;
                if (np && np.asset) {
                    var parts = np.asset.replace("nameplates/", "").replace(/\/$/, "").split("/");
                    upsertRule(src + "$" + (parts[0] || "") + "$" + (parts[1] || "") + "$" + (np.palette || ""), "");
                }
                if (targetData.clan && targetData.clan.tag) upsertRule("__redir_clan_" + src, targetData.clan.tag);
            }
            store.redirectSource = src; store.redirectTarget = tgt; store.redirectEnabled = true;
            alert("Redirect applied!");
        }

        function clearRedirect() {
            removeRule(sourceId.trim());
            store.redirectEnabled = false; setTargetData(null);
            alert("Redirect cleared.");
        }

        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.section }, "Configuration"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: S.lbl }, "Source User ID (Redirect FROM)"),
                React.createElement(TextInput, { placeholder: "Your user ID\u2026", placeholderTextColor: "#4e5058", value: sourceId, onChangeText: setSourceId, keyboardType: "numeric", style: S.inp }),
                React.createElement(Text, { style: S.lbl }, "Target User ID (Redirect TO)"),
                React.createElement(TextInput, { placeholder: "Target user ID\u2026", placeholderTextColor: "#4e5058", value: targetId, onChangeText: setTargetId, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: fetching ? "Fetching\u2026" : "Fetch Target User Data", onPress: fetchTarget, style: S.blue }),
                targetData && React.createElement(View, { style: S.infoBox },
                    React.createElement(InfoRow, { label: "Username", value: targetData.username }),
                    React.createElement(InfoRow, { label: "Global Name", value: targetData.global_name }),
                    React.createElement(InfoRow, { label: "Avatar", value: targetData.avatar }),
                    React.createElement(InfoRow, { label: "Decoration", value: targetData.avatar_decoration_data && targetData.avatar_decoration_data.asset }),
                    React.createElement(InfoRow, { label: "Nameplate", value: targetData.collectibles && targetData.collectibles.nameplate && targetData.collectibles.nameplate.asset }),
                    React.createElement(InfoRow, { label: "Clan Tag", value: targetData.clan && targetData.clan.tag }),
                    React.createElement(InfoRow, { label: "Clan ID", value: targetData.clan && targetData.clan.identity_guild_id })
                )
            ),
            React.createElement(Text, { style: S.section }, "Status"),
            React.createElement(View, { style: S.card },
                React.createElement(ToggleRow, { label: "Enable Redirect", value: !!store.redirectEnabled, onChange: function (val) { store.redirectEnabled = val; } })
            ),
            React.createElement(Text, { style: S.section }, "Actions"),
            React.createElement(View, { style: S.card },
                React.createElement(Btn, { label: "Get My ID (Sets Source ID)", onPress: getMyId, style: S.grey }),
                React.createElement(Btn, { label: "Apply Redirect", onPress: applyRedirect, style: S.green }),
                React.createElement(Btn, { label: "Clear Redirect", onPress: clearRedirect, style: S.red })
            ),
            React.createElement(View, { style: { height: 40 } })
        );
    }

    function NameChangerPage() {
        storage.useProxy(store);
        var idState = React.useState(store.nameTargetId || ""); var targetId = idState[0]; var setTargetId = idState[1];
        var aliasState = React.useState(store.nameAlias || ""); var alias = aliasState[0]; var setAlias = aliasState[1];
        var fetchingState = React.useState(false); var fetching = fetchingState[0]; var setFetching = fetchingState[1];
        var dataState = React.useState(null); var userData = dataState[0]; var setUserData = dataState[1];

        function fetchUser() {
            setFetching(true); setUserData(null);
            fetchDiscordUser(targetId).then(function (data) {
                setUserData(data);
                if (!alias) setAlias(data.global_name || data.username || "");
                setFetching(false);
            }).catch(function (e) { alert(e.message); setFetching(false); });
        }

        function save() {
            var id = targetId.trim(); var name = alias.trim();
            if (!id || !name) { alert("Both fields are required."); return; }
            upsertRule("__name_global_" + id, name);
            upsertRule("__name_user_" + id, name);
            store.nameTargetId = id; store.nameAlias = name;
            alert("Alias saved.");
        }

        function clear() {
            var id = targetId.trim();
            removeRule("__name_global_" + id); removeRule("__name_user_" + id);
            setAlias(""); store.nameAlias = "";
            alert("Alias cleared.");
        }

        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.section }, "Alias Settings"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: S.lbl }, "Target User ID"),
                React.createElement(TextInput, { placeholder: "User ID to rename\u2026", placeholderTextColor: "#4e5058", value: targetId, onChangeText: function (v) { setTargetId(v); store.nameTargetId = v; }, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: fetching ? "Fetching\u2026" : "Look Up User", onPress: fetchUser, style: S.blue }),
                userData && React.createElement(View, { style: S.infoBox },
                    React.createElement(InfoRow, { label: "Username", value: userData.username }),
                    React.createElement(InfoRow, { label: "Global Name", value: userData.global_name }),
                    React.createElement(InfoRow, { label: "Decoration", value: userData.avatar_decoration_data && userData.avatar_decoration_data.asset }),
                    React.createElement(InfoRow, { label: "Nameplate", value: userData.collectibles && userData.collectibles.nameplate && userData.collectibles.nameplate.asset }),
                    React.createElement(InfoRow, { label: "Clan Tag", value: userData.clan && userData.clan.tag })
                ),
                React.createElement(View, { style: S.div }),
                React.createElement(Text, { style: S.lbl }, "New Name (Alias)"),
                React.createElement(TextInput, { placeholder: "Display name to show\u2026", placeholderTextColor: "#4e5058", value: alias, onChangeText: setAlias, style: S.inp }),
                React.createElement(Btn, { label: "Save Alias", onPress: save, style: S.green }),
                React.createElement(Btn, { label: "Clear Alias", onPress: clear, style: S.red })
            ),
            React.createElement(View, { style: { height: 40 } })
        );
    }

    function DecorationChangerPage() {
        storage.useProxy(store);
        var idState = React.useState(store.decoTargetId || ""); var targetId = idState[0]; var setTargetId = idState[1];
        var assetState = React.useState(store.decoAsset || ""); var assetId = assetState[0]; var setAssetId = assetState[1];
        var skuState = React.useState(store.decoSkuId || ""); var skuId = skuState[0]; var setSkuId = skuState[1];
        var fetchingState = React.useState(false); var fetching = fetchingState[0]; var setFetching = fetchingState[1];
        var dataState = React.useState(null); var userData = dataState[0]; var setUserData = dataState[1];

        function fetchUser() {
            setFetching(true); setUserData(null);
            fetchDiscordUser(targetId).then(function (data) {
                setUserData(data);
                var deco = data.avatar_decoration_data;
                if (deco) {
                    if (!assetId) setAssetId(deco.asset || "");
                    if (!skuId) setSkuId(String(deco.sku_id || ""));
                }
                setFetching(false);
            }).catch(function (e) { alert(e.message); setFetching(false); });
        }

        function save() {
            var id = targetId.trim(); var asset = assetId.trim();
            if (!id || !asset) { alert("User ID and Asset ID are required."); return; }
            upsertRule(id + "/" + asset, id + "/" + asset);
            store.decoTargetId = id; store.decoAsset = asset; store.decoSkuId = skuId.trim();
            alert("Decoration saved.");
        }

        function clear() {
            removeRule(targetId.trim() + "/" + assetId.trim());
            setAssetId(""); setSkuId("");
            store.decoAsset = ""; store.decoSkuId = "";
            alert("Decoration cleared.");
        }

        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.section }, "Decoration Settings"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: S.lbl }, "Target User ID"),
                React.createElement(TextInput, { placeholder: "User ID\u2026", placeholderTextColor: "#4e5058", value: targetId, onChangeText: function (v) { setTargetId(v); store.decoTargetId = v; }, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: fetching ? "Fetching\u2026" : "Fetch User Decoration", onPress: fetchUser, style: S.blue }),
                userData && React.createElement(View, { style: S.infoBox },
                    React.createElement(InfoRow, { label: "Username", value: userData.username }),
                    React.createElement(InfoRow, { label: "Asset", value: userData.avatar_decoration_data && userData.avatar_decoration_data.asset }),
                    React.createElement(InfoRow, { label: "SKU ID", value: userData.avatar_decoration_data && String(userData.avatar_decoration_data.sku_id || "") }),
                    React.createElement(InfoRow, { label: "Nameplate", value: userData.collectibles && userData.collectibles.nameplate && userData.collectibles.nameplate.asset }),
                    React.createElement(InfoRow, { label: "Palette", value: userData.collectibles && userData.collectibles.nameplate && userData.collectibles.nameplate.palette })
                ),
                React.createElement(View, { style: S.div }),
                React.createElement(Text, { style: S.lbl }, "Asset ID"),
                React.createElement(TextInput, { placeholder: "a_1ffd338bf104b616ea\u2026", placeholderTextColor: "#4e5058", value: assetId, onChangeText: setAssetId, autoCapitalize: "none", style: S.inp }),
                React.createElement(Text, { style: S.lbl }, "SKU ID"),
                React.createElement(TextInput, { placeholder: "1385050947834613820", placeholderTextColor: "#4e5058", value: skuId, onChangeText: setSkuId, keyboardType: "numeric", style: S.inp }),
                React.createElement(Btn, { label: "Save Decoration", onPress: save, style: S.green }),
                React.createElement(Btn, { label: "Clear Decoration", onPress: clear, style: S.red })
            ),
            React.createElement(View, { style: { height: 40 } })
        );
    }

    function SettingsPage() {
        storage.useProxy(store);
        var pageState = React.useState("home"); var page = pageState[0]; var setPage = pageState[1];

        if (page === "redirector") return React.createElement(SubPage, { title: "Dynamic Profile Redirector", onBack: function () { setPage("home"); }, Page: RedirectorPage });
        if (page === "name") return React.createElement(SubPage, { title: "Name Changer", onBack: function () { setPage("home"); }, Page: NameChangerPage });
        if (page === "deco") return React.createElement(SubPage, { title: "Decoration Changer", onBack: function () { setPage("home"); }, Page: DecorationChangerPage });

        var token = getToken();
        var tokenOk = !!token;

        return React.createElement(ScrollView, { style: S.page },
            React.createElement(Text, { style: S.section }, "Global"),
            React.createElement(View, { style: S.card },
                React.createElement(ToggleRow, { label: "Enable all replacements", value: !!store.enabled, onChange: function (val) { store.enabled = val; } })
            ),

            React.createElement(Text, { style: S.section }, "Token"),
            React.createElement(View, { style: S.card },
                React.createElement(Text, { style: { color: tokenOk ? "#23a55a" : "#f23f43", fontSize: 13, fontWeight: "600", marginBottom: 6 } },
                    tokenOk ? "\u2713 Token set" : "\u2717 No token set"
                ),
                React.createElement(TextInput, {
                    placeholder: "Bot or user token\u2026",
                    placeholderTextColor: "#4e5058",
                    value: store.authToken || "",
                    onChangeText: function (v) { store.authToken = v; },
                    autoCapitalize: "none",
                    autoCorrect: false,
                    style: S.inp,
                })
            ),

            React.createElement(Text, { style: S.section }, "Features"),
            NavCard({ label: "Dynamic Profile Redirector", sub: "Redirect one user's profile to appear as another", badge: store.redirectEnabled ? "ON" : null, onPress: function () { setPage("redirector"); } }),
            NavCard({ label: "Name Changer", sub: "Assign a local alias to any user", badge: store.nameAlias || null, onPress: function () { setPage("name"); } }),
            NavCard({ label: "Decoration Changer", sub: "Override a user's avatar decoration", badge: store.decoAsset ? "SET" : null, onPress: function () { setPage("deco"); } }),
            React.createElement(View, { style: { height: 40 } })
        );
    }

    function applyPatches() {
        var UserProfilePrimaryInfo = metro.findByName("UserProfilePrimaryInfo", false);
        var UserProfileAboutMeCard = metro.findByName("UserProfileAboutMeCard", false);
        var ChatViewWrapperBase = metro.findByName("ChatViewWrapperBase", false);
        var UserStore = metro.findByStoreName("UserStore");

        _unpatchers.push(patcher.after("getUser", UserStore, function (args, user) {
            if (!store.enabled) return;
            var userId = args[0]; var rules = getCompiledRules();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                var raw = rule.re.source.replace(/\\\\/g, "\\").replace(/\\/g, "");
                var ap = raw.split("/");
                if (ap.length > 1 && ap[0] === userId)
                    user.avatarDecorationData = { asset: ap[1], skuId: undefined, expiresAt: null };
                var sp = raw.split("%");
                if (sp.length > 1 && sp[0] === userId)
                    user.displayNameStyles = { fontId: sp[1], effectId: sp[2], colors: sp.slice(3) };
                var cp = raw.split("$");
                if (cp.length > 1 && cp[0] === userId)
                    user.collectibles = { nameplate: { asset: "nameplates/" + cp[1] + "/" + cp[2] + "/", skuId: undefined, expiresAt: null, label: undefined, palette: cp[3] } };
                if (user && user.primaryGuild && user.primaryGuild.tag)
                    user.primaryGuild.tag = user.primaryGuild.tag.replace(rule.re, rule.to);
            }
        }));

        _unpatchers.push(patcher.before("generate", RowManager.prototype, function (args) {
            if (!store.enabled) return;
            try {
                var row = args[0]; var rules = getCompiledRules();
                for (var i = 0; i < rules.length; i++) {
                    var rule = rules[i]; var msg = row && row.message; var author = msg && msg.author;
                    if (msg && msg.content) msg.content = msg.content.replace(rule.re, rule.to);
                    if (author && author.id) author.id = author.id.replace(rule.re, rule.to);
                    if (author && author.avatar) author.avatar = author.avatar.replace(rule.re, rule.to);
                    if (author && author.avatarDecorationData && author.avatarDecorationData.asset) author.avatarDecorationData.asset = author.avatarDecorationData.asset.replace(rule.re, rule.to);
                    if (author && author.primaryGuild && author.primaryGuild.tag) author.primaryGuild.tag = author.primaryGuild.tag.replace(rule.re, rule.to);
                    if (author && author.primaryGuild && author.primaryGuild.badge) author.primaryGuild.badge = author.primaryGuild.badge.replace(rule.re, rule.to);
                    if (author && author.primaryGuild && author.primaryGuild.identityGuildId) author.primaryGuild.identityGuildId = author.primaryGuild.identityGuildId.replace(rule.re, rule.to);
                    if (author && author.username) author.username = author.username.replace(rule.re, rule.to);
                    if (author && author.globalName) author.globalName = author.globalName.replace(rule.re, rule.to);
                    if (msg && msg.attachments && msg.attachments.length) {
                        msg.attachments.forEach(function (att) {
                            if (att.url && att.url.match(rule.re)) { att.url = rule.to; att.proxy_url = rule.to; }
                        });
                    }
                }
            } catch (e) { }
        }));

        _unpatchers.push(patcher.after("default", UserProfilePrimaryInfo, function (_args, result) {
            if (!store.enabled) return;
            try {
                var rules = getCompiledRules();
                for (var i = 0; i < rules.length; i++) {
                    var tag = result && result.props && result.props.children[1] && result.props.children[1].props && result.props.children[1].props.children[0] && result.props.children[1].props.children[0].props && result.props.children[1].props.children[0].props.userTag;
                    if (tag) result.props.children[1].props.children[0].props.userTag = tag.replace(rules[i].re, rules[i].to);
                }
            } catch (e) { }
        }));

        _unpatchers.push(patcher.after("default", UserProfileAboutMeCard, function (_args, result) {
            if (!store.enabled) return;
            try {
                var rules = getCompiledRules();
                for (var i = 0; i < rules.length; i++) {
                    var uid = result && result.props && result.props.children[1] && result.props.children[1].props && result.props.children[1].props.userId;
                    if (uid) result.props.children[1].props.userId = uid.replace(rules[i].re, rules[i].to);
                }
            } catch (e) { }
        }));

        _unpatchers.push(patcher.after("default", ChatViewWrapperBase, function (_args, result) {
            if (!store.enabled) return;
            try {
                var rules = getCompiledRules();
                var recipients = result.props.children.props.children.filter(Boolean)[0].props.children.props.channel.recipients;
                for (var i = 0; i < rules.length; i++) {
                    var rule = rules[i];
                    recipients.forEach(function (id, idx) { recipients[idx] = id.replace(rule.re, rule.to); });
                }
            } catch (e) { }
        }));
    }

    var pluginExport = {
        settings: function () { return React.createElement(SettingsPage, null); },
        onLoad: function () { setTimeout(function () { applyPatches(); }, 0); },
        onUnload: function () { _unpatchers.forEach(function (fn) { if (fn) fn(); }); _unpatchers = []; },
    };

    exports.default = pluginExport;
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