(function (exports, components, pluginApi, storage, assets, metro, patcher) {
    "use strict";

    const { ScrollView, Text, View, TextInput, Switch } = components.General;
    const { FormRow, FormIcon, FormDivider } = components.Forms;
    const RowManager = metro.findByName("RowManager");
    let _unpatchers = [];
    //omg
    const store = pluginApi.storage;
    store.enabled ??= true;
    store.authToken ??= "";
    store.redirectEnabled ??= false;
    store.sourceId ??= "";
    store.targetId ??= "";
    store.targetData ??= "";

    function getToken() {
        var t = (store.authToken || "").trim();
        return t || null;
    }

    function authHeader() {
        var t = getToken();
        if (!t) return null;
        return t.startsWith("Bot ") || t.startsWith("Bearer ") ? t : "Bot " + t;
    }

    function fetchDiscordUser(userId) {
        var auth = authHeader();
        if (!auth) return Promise.reject(new Error("No token set."));
        if (!userId || !userId.trim()) return Promise.reject(new Error("No User ID provided."));
        return fetch("https://discord.com/api/v10/users/" + userId.trim(), {
            headers: { Authorization: auth, "User-Agent": "utopia/12.3.1", Accept: "*/*" },
        }).then(function (res) {
            if (res.ok) return res.json();
            return res.json().catch(function () { return {}; }).then(function (err) {
                throw new Error("Discord API error " + res.status + ": " + (err.message || res.statusText));
            });
        });
    }

    var S = {
        bg: { flex: 1, backgroundColor: "#1a1b1e" },
        section: { marginTop: 20, marginBottom: 8, paddingHorizontal: 16, fontSize: 11, fontWeight: "600", color: "#8e9297", letterSpacing: 0.8 },
        block: { backgroundColor: "#2b2d31", marginHorizontal: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#1e1f22" },
        row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: "#1e1f22" },
        rowLast: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
        rowLabel: { color: "#b5bac1", fontSize: 14 },
        rowValue: { color: "#dbdee1", fontSize: 14, flex: 1, textAlign: "right", marginLeft: 8 },
        inp: { color: "#dbdee1", fontSize: 14, flex: 1, textAlign: "right", marginLeft: 8, padding: 0 },
        actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: "#1e1f22" },
        icon: { width: 28, height: 28, borderRadius: 4, backgroundColor: "#4e5058", marginRight: 12, alignItems: "center", justifyContent: "center" },
        iconTxt: { fontSize: 14 },
        actionLbl: { color: "#dbdee1", fontSize: 15 },
        infoBox: { backgroundColor: "#1e1f22", margin: 12, borderRadius: 8, padding: 12 },
        infoRow: { flexDirection: "row", marginBottom: 4 },
        infoKey: { color: "#8e9297", fontSize: 12, width: 110 },
        infoVal: { color: "#dbdee1", fontSize: 12, flex: 1 },
        btnRow: { flexDirection: "row", margin: 12, gap: 8 },
        btn: { flex: 1, borderRadius: 6, paddingVertical: 12, alignItems: "center" },
        btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
    };

    function InfoRow(props) {
        if (!props.value) return null;
        return React.createElement(View, { style: S.infoRow },
            React.createElement(Text, { style: S.infoKey }, props.label),
            React.createElement(Text, { style: S.infoVal }, String(props.value))
        );
    }

    function SettingsPage() {
        var srcState = React.useState(store.sourceId || ""); var sourceId = srcState[0]; var setSourceId = srcState[1];
        var tgtState = React.useState(store.targetId || ""); var targetId = tgtState[0]; var setTargetId = tgtState[1];
        var fetchState = React.useState(false); var fetching = fetchState[0]; var setFetching = fetchState[1];
        var dataState = React.useState(store.targetData ? JSON.parse(store.targetData) : null); var targetData = dataState[0]; var setTargetData = dataState[1];

        var UserStore = metro.findByStoreName("UserStore");

        function getMyId() {
            try {
                var me = UserStore.getCurrentUser();
                if (me && me.id) { setSourceId(me.id); store.sourceId = me.id; }
            } catch (e) { alert("Could not read current user ID."); }
        }

        function fetchTarget() {
            var id = targetId.trim();
            if (!id) { alert("Enter a Target User ID first."); return; }
            setFetching(true); setTargetData(null);
            fetchDiscordUser(id).then(function (data) {
                setTargetData(data);
                store.targetData = JSON.stringify(data);
                store.targetId = id;
                setFetching(false);
            }).catch(function (e) { alert(e.message); setFetching(false); });
        }

        function applyRedirect() {
            var src = sourceId.trim(); var tgt = targetId.trim();
            if (!src || !tgt) { alert("Both IDs are required."); return; }
            store.sourceId = src; store.targetId = tgt; store.redirectEnabled = true;
            alert("Redirect applied!");
        }

        function clearRedirect() {
            store.redirectEnabled = false; store.targetData = "";
            setTargetData(null);
            alert("Redirect cleared.");
        }

        return React.createElement(ScrollView, { style: S.bg },

            React.createElement(Text, { style: S.section }, "CONFIGURATION"),
            React.createElement(View, { style: S.block },
                React.createElement(View, { style: S.row },
                    React.createElement(Text, { style: S.rowLabel }, "Source User ID (Redirect FROM)"),
                    React.createElement(TextInput, {
                        placeholder: "ID\u2026", placeholderTextColor: "#4e5058",
                        value: sourceId,
                        onChangeText: function (v) { setSourceId(v); store.sourceId = v; },
                        keyboardType: "numeric", style: S.inp,
                    })
                ),
                React.createElement(View, { style: S.rowLast },
                    React.createElement(Text, { style: S.rowLabel }, "Target User ID (Redirect TO)"),
                    React.createElement(TextInput, {
                        placeholder: "ID\u2026", placeholderTextColor: "#4e5058",
                        value: targetId,
                        onChangeText: function (v) { setTargetId(v); store.targetId = v; },
                        keyboardType: "numeric", style: S.inp,
                    })
                )
            ),

            targetData && React.createElement(View, { style: S.infoBox },
                React.createElement(InfoRow, { label: "Username", value: targetData.username }),
                React.createElement(InfoRow, { label: "Global Name", value: targetData.global_name }),
                React.createElement(InfoRow, { label: "Avatar", value: targetData.avatar }),
                React.createElement(InfoRow, { label: "Decoration", value: targetData.avatar_decoration_data && targetData.avatar_decoration_data.asset }),
                React.createElement(InfoRow, { label: "Nameplate", value: targetData.collectibles && targetData.collectibles.nameplate && targetData.collectibles.nameplate.asset }),
                React.createElement(InfoRow, { label: "Clan Tag", value: targetData.clan && targetData.clan.tag })
            ),

            React.createElement(Text, { style: S.section }, "STATUS"),
            React.createElement(View, { style: S.block },
                React.createElement(View, { style: S.rowLast },
                    React.createElement(Text, { style: [S.rowLabel, { color: "#dbdee1", fontWeight: "500" }] }, "Enable Redirect"),
                    React.createElement(View, { style: { width: 51 } },
                        React.createElement(Switch, { value: !!store.redirectEnabled, onValueChange: function (val) { store.redirectEnabled = val; }, trackColor: { false: "#4e5058", true: "#5865f2" } })
                    )
                )
            ),

            React.createElement(Text, { style: S.section }, "ACTIONS"),
            React.createElement(View, { style: S.block },
                React.createElement(View, { style: S.actionRow },
                    React.createElement(View, { style: [S.icon, { backgroundColor: "#4e5058" }] },
                        React.createElement(Text, { style: S.iconTxt }, "\uD83D\uDD11")
                    ),
                    React.createElement(Text, { style: S.actionLbl, onPress: getMyId, suppressHighlighting: true }, "Get My ID (Sets Source ID)")
                ),
                React.createElement(View, { style: S.actionRow },
                    React.createElement(View, { style: [S.icon, { backgroundColor: "#5865f2" }] },
                        React.createElement(Text, { style: S.iconTxt }, "\uD83D\uDD0D")
                    ),
                    React.createElement(Text, { style: S.actionLbl, onPress: fetchTarget, suppressHighlighting: true }, fetching ? "Fetching\u2026" : "Fetch Target User Data")
                ),
                React.createElement(View, { style: S.actionRow },
                    React.createElement(View, { style: [S.icon, { backgroundColor: "#23a55a" }] },
                        React.createElement(Text, { style: S.iconTxt }, "\u2713")
                    ),
                    React.createElement(Text, { style: S.actionLbl, onPress: applyRedirect, suppressHighlighting: true }, "Apply Redirect")
                ),
                React.createElement(View, { style: S.rowLast },
                    React.createElement(View, { style: [S.icon, { backgroundColor: "#f23f43" }] },
                        React.createElement(Text, { style: S.iconTxt }, "\u2715")
                    ),
                    React.createElement(Text, { style: S.actionLbl, onPress: clearRedirect, suppressHighlighting: true }, "Clear Redirect")
                )
            ),

            React.createElement(Text, { style: S.section }, "TOKEN"),
            React.createElement(View, { style: S.block },
                React.createElement(View, { style: S.rowLast },
                    React.createElement(TextInput, {
                        placeholder: "Bot or user token\u2026", placeholderTextColor: "#4e5058",
                        value: store.authToken || "",
                        onChangeText: function (v) { store.authToken = v; },
                        autoCapitalize: "none", autoCorrect: false,
                        style: [S.inp, { textAlign: "left" }],
                    })
                )
            ),

            React.createElement(View, { style: { height: 40 } })
        );
    }

    function applyPatches() {
        var UserProfilePrimaryInfo = metro.findByName("UserProfilePrimaryInfo", false);
        var UserProfileAboutMeCard = metro.findByName("UserProfileAboutMeCard", false);
        var ChatViewWrapperBase = metro.findByName("ChatViewWrapperBase", false);
        var UserStore = metro.findByStoreName("UserStore");

        function getRedirect() {
            if (!store.enabled || !store.redirectEnabled) return null;
            var src = (store.sourceId || "").trim();
            var tgt = (store.targetId || "").trim();
            if (!src || !tgt) return null;
            var td = store.targetData; return { src: src, tgt: tgt, data: td ? JSON.parse(td) : null };
        }

        _unpatchers.push(patcher.after("getUser", UserStore, function (args, user) {
            var r = getRedirect(); if (!r) return;
            if (!user || args[0] !== r.src) return;
            if (!r.data) return;
            var d = r.data;
            if (d.avatar) user.avatar = d.avatar;
            if (d.username) user.username = d.username;
            if (d.global_name) user.globalName = d.global_name;
            var deco = d.avatar_decoration_data;
            if (deco && deco.asset) user.avatarDecorationData = { asset: deco.asset, skuId: deco.sku_id, expiresAt: null };
            var np = d.collectibles && d.collectibles.nameplate;
            if (np && np.asset) user.collectibles = { nameplate: { asset: np.asset, skuId: undefined, expiresAt: null, label: undefined, palette: np.palette } };
            var clan = d.clan;
            if (clan && clan.tag && user.primaryGuild) user.primaryGuild.tag = clan.tag;
        }));

        _unpatchers.push(patcher.before("generate", RowManager.prototype, function (args) {
            var r = getRedirect(); if (!r) return;
            try {
                var row = args[0]; var msg = row && row.message; var author = msg && msg.author;
                if (!author || author.id !== r.src) return;
                if (!r.data) return;
                var d = r.data;
                if (d.avatar) author.avatar = d.avatar;
                if (d.username) author.username = d.username;
                if (d.global_name) author.globalName = d.global_name;
                var deco = d.avatar_decoration_data;
                if (deco && deco.asset) author.avatarDecorationData = { asset: deco.asset, skuId: deco.sku_id, expiresAt: null };
                var clan = d.clan;
                if (clan) {
                    if (clan.tag && author.primaryGuild) author.primaryGuild.tag = clan.tag;
                    if (clan.identity_guild_id && author.primaryGuild) author.primaryGuild.identityGuildId = clan.identity_guild_id;
                }
            } catch (e) { }
        }));

        _unpatchers.push(patcher.after("default", UserProfilePrimaryInfo, function (args, result) {
            var r = getRedirect(); if (!r || !r.data) return;
            try {
                var props = result && result.props && result.props.children[1] && result.props.children[1].props;
                if (!props) return;
                var tagNode = props.children[0] && props.children[0].props;
                if (tagNode && tagNode.userTag && tagNode.userTag.includes(r.src)) {
                    tagNode.userTag = r.data.username ? "@" + r.data.username : tagNode.userTag;
                }
            } catch (e) { }
        }));

        _unpatchers.push(patcher.after("default", UserProfileAboutMeCard, function (args, result) {
            var r = getRedirect(); if (!r) return;
            try {
                var child = result && result.props && result.props.children[1] && result.props.children[1].props;
                if (child && child.userId === r.src) child.userId = r.tgt;
            } catch (e) { }
        }));

        _unpatchers.push(patcher.after("default", ChatViewWrapperBase, function (args, result) {
            var r = getRedirect(); if (!r) return;
            try {
                var recipients = result.props.children.props.children.filter(Boolean)[0].props.children.props.channel.recipients;
                recipients.forEach(function (id, idx) { if (id === r.src) recipients[idx] = r.tgt; });
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
