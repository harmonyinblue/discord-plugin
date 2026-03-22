(function (exports, components, plugin, storage, assets, metro, patcher) {
    "use strict";

    // ─── UI Components ────────────────────────────────────────────────────────────
    const { ScrollView, Text, View, TextInput, Button, ActivityIndicator } = components.General;
    const { FormRow, FormIcon, FormDivider, FormSwitchRow, FormSection, FormText } = components.Forms;
    const { Navigator } = components.Navigation ?? {};

    // ─── Internal State ───────────────────────────────────────────────────────────
    const RowManager = metro.findByName("RowManager");
    const Router = metro.findByName("Router") ?? metro.findByProps("transitionTo");
    let _unpatchers = [];

    // ─── Storage Defaults ─────────────────────────────────────────────────────────
    storage.storage.rules ??= JSON.stringify([]);
    storage.storage.enabled ??= true;
    storage.storage.authToken ??= "";
    // Profile Redirector
    storage.storage.redirectEnabled ??= false;
    storage.storage.redirectSource ??= "";
    storage.storage.redirectTarget ??= "";
    // Name Changer
    storage.storage.nameTargetId ??= "";
    storage.storage.nameAlias ??= "";
    // Decoration Changer
    storage.storage.decoTargetId ??= "";
    storage.storage.decoAsset ??= "";
    storage.storage.decoSkuId ??= "";

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function getCompiledRules() {
        return JSON.parse(storage.storage.rules || "[]")
            .map((rule) => {
                try {
                    if (!rule.find || rule.find === "") return null;
                    return {
                        re: new RegExp(
                            rule.regex ? rule.find : escapeRegex(rule.find),
                            rule.ci ? "gi" : "g"
                        ),
                        to: rule.replace ?? "",
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    }

    /**
     * Fetch a user's data from the Discord API using the stored auth token.
     * Returns the parsed JSON or throws on failure.
     */
    async function fetchDiscordUser(userId) {
        const token = storage.storage.authToken?.trim();
        if (!token) throw new Error("No auth token set. Go to Bot Token settings first.");
        if (!userId?.trim()) throw new Error("No User ID provided.");

        const res = await fetch(`https://discord.com/api/v10/users/${userId.trim()}`, {
            headers: { Authorization: token },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`Discord API error ${res.status}: ${err.message ?? res.statusText}`);
        }

        return res.json();
    }

    /**
     * Upsert (add or replace) a rule in storage by its `find` key.
     */
    function upsertRule(find, replace) {
        if (!find) return;
        const rules = JSON.parse(storage.storage.rules || "[]");
        const idx = rules.findIndex((r) => r.find === find);
        if (idx >= 0) {
            rules[idx] = { ...rules[idx], replace };
        } else {
            rules.push({ find, replace, regex: false, ci: false });
        }
        storage.storage.rules = JSON.stringify(rules);
    }

    /**
     * Remove a rule from storage by its `find` key.
     */
    function removeRule(find) {
        if (!find) return;
        const rules = JSON.parse(storage.storage.rules || "[]");
        storage.storage.rules = JSON.stringify(rules.filter((r) => r.find !== find));
    }

    // ─── Shared Styles ────────────────────────────────────────────────────────────

    const S = {
        section: {
            marginTop: 16,
            marginBottom: 4,
            marginHorizontal: 16,
            fontSize: 12,
            fontWeight: "600",
            color: "#8e9297",
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        card: {
            backgroundColor: "#2b2d31",
            marginHorizontal: 12,
            marginBottom: 2,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        label: {
            fontSize: 13,
            color: "#8e9297",
            marginBottom: 4,
        },
        value: {
            fontSize: 15,
            color: "#dbdee1",
        },
        input: {
            backgroundColor: "#1e1f22",
            borderRadius: 4,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: "#dbdee1",
            fontSize: 15,
            marginTop: 4,
        },
        inputLabel: {
            fontSize: 13,
            color: "#8e9297",
            marginTop: 12,
            marginBottom: 2,
        },
        row: {
            backgroundColor: "#2b2d31",
            marginHorizontal: 12,
            borderRadius: 0,
        },
        statusBadge: (ok) => ({
            alignSelf: "flex-start",
            backgroundColor: ok ? "#23a55a" : "#f23f43",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 3,
            marginTop: 8,
        }),
        statusText: {
            color: "#fff",
            fontSize: 12,
            fontWeight: "600",
        },
        fetchBtn: {
            marginTop: 14,
            backgroundColor: "#5865f2",
            borderRadius: 4,
            paddingVertical: 10,
            alignItems: "center",
        },
        fetchBtnText: {
            color: "#fff",
            fontWeight: "700",
            fontSize: 14,
        },
        saveBtn: {
            marginTop: 10,
            backgroundColor: "#23a55a",
            borderRadius: 4,
            paddingVertical: 10,
            alignItems: "center",
        },
        saveBtnText: {
            color: "#fff",
            fontWeight: "700",
            fontSize: 14,
        },
        clearBtn: {
            marginTop: 8,
            backgroundColor: "#f23f43",
            borderRadius: 4,
            paddingVertical: 10,
            alignItems: "center",
        },
        clearBtnText: {
            color: "#fff",
            fontWeight: "700",
            fontSize: 14,
        },
        divider: {
            height: 1,
            backgroundColor: "#1e1f22",
            marginVertical: 6,
        },
        infoBox: {
            backgroundColor: "#1e1f22",
            borderRadius: 6,
            padding: 12,
            marginTop: 8,
        },
        infoRow: {
            flexDirection: "row",
            marginBottom: 4,
        },
        infoKey: {
            color: "#8e9297",
            fontSize: 12,
            width: 120,
        },
        infoVal: {
            color: "#dbdee1",
            fontSize: 12,
            flex: 1,
        },
    };

    // ─── Reusable: InfoRow inside a fetched-data box ───────────────────────────
    function InfoRow({ label, value }) {
        if (!value || value === "N/A") return null;
        return React.createElement(
            View,
            { style: S.infoRow },
            React.createElement(Text, { style: S.infoKey }, label),
            React.createElement(Text, { style: S.infoVal }, value)
        );
    }

    // ─── Reusable: Touchable button ───────────────────────────────────────────────
    function Btn({ label, onPress, style, textStyle }) {
        return React.createElement(
            View,
            { style: [S.fetchBtn, style] },
            React.createElement(
                Text,
                {
                    style: [S.fetchBtnText, textStyle],
                    onPress,
                    suppressHighlighting: true,
                },
                label
            )
        );
    }

    // ─── Page: Token Settings ─────────────────────────────────────────────────────
    function TokenSettingsPage() {
        storage.useProxy(storage.storage);
        const [draft, setDraft] = React.useState(storage.storage.authToken || "");
        const [testing, setTesting] = React.useState(false);
        const [testResult, setTestResult] = React.useState(null); // null | "ok" | "fail"

        const save = () => {
            storage.storage.authToken = draft.trim();
            alert("Token saved.");
        };

        const test = async () => {
            setTesting(true);
            setTestResult(null);
            try {
                const res = await fetch("https://discord.com/api/v10/users/@me", {
                    headers: { Authorization: draft.trim() },
                });
                setTestResult(res.ok ? "ok" : "fail");
            } catch {
                setTestResult("fail");
            } finally {
                setTesting(false);
            }
        };

        return React.createElement(
            ScrollView,
            { style: { flex: 1, backgroundColor: "#1e1f22" } },

            React.createElement(Text, { style: S.section }, "Auth Token"),

            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },

                React.createElement(
                    Text,
                    { style: { color: "#8e9297", fontSize: 13, lineHeight: 18, marginBottom: 10 } },
                    "Enter your Discord user token. This is used to fetch user data from the Discord API. " +
                    "Your token never leaves your device."
                ),

                React.createElement(TextInput, {
                    placeholder: "Your Discord token…",
                    placeholderTextColor: "#4e5058",
                    value: draft,
                    onChangeText: setDraft,
                    secureTextEntry: true,
                    autoCapitalize: "none",
                    autoCorrect: false,
                    style: S.input,
                }),

                testResult !== null &&
                React.createElement(
                    View,
                    { style: S.statusBadge(testResult === "ok") },
                    React.createElement(
                        Text,
                        { style: S.statusText },
                        testResult === "ok" ? "✓ Token valid" : "✗ Token invalid or request failed"
                    )
                ),

                React.createElement(
                    View,
                    { style: { flexDirection: "row", gap: 8, marginTop: 14 } },

                    React.createElement(
                        View,
                        { style: { flex: 1 } },
                        React.createElement(Btn, {
                            label: testing ? "Testing…" : "Test Token",
                            onPress: test,
                            style: { marginTop: 0 },
                        })
                    ),

                    React.createElement(
                        View,
                        { style: { flex: 1 } },
                        React.createElement(Btn, {
                            label: "Save",
                            onPress: save,
                            style: { marginTop: 0, backgroundColor: "#23a55a" },
                        })
                    )
                )
            ),

            React.createElement(Text, { style: [S.section, { marginTop: 20 }] }, "Where to find your token"),
            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },
                React.createElement(
                    Text,
                    { style: { color: "#8e9297", fontSize: 13, lineHeight: 20 } },
                    "1. Open Discord on desktop\n" +
                    "2. Press Ctrl+Shift+I (DevTools)\n" +
                    "3. Go to the Network tab\n" +
                    "4. Send any message\n" +
                    "5. Find the request and look for the 'Authorization' header\n\n" +
                    "⚠️  Never share your token with anyone."
                )
            ),

            React.createElement(View, { style: { height: 40 } })
        );
    }

    // ─── Page: Dynamic Profile Redirector ────────────────────────────────────────
    function RedirectorPage() {
        storage.useProxy(storage.storage);

        const [sourceId, setSourceId] = React.useState(storage.storage.redirectSource || "");
        const [targetId, setTargetId] = React.useState(storage.storage.redirectTarget || "");
        const [fetchingTarget, setFetchingTarget] = React.useState(false);
        const [targetData, setTargetData] = React.useState(null);

        const myUserStore = metro.findByStoreName("UserStore");
        const getMyId = () => {
            try {
                const me = myUserStore.getCurrentUser();
                if (me?.id) {
                    setSourceId(me.id);
                    storage.storage.redirectSource = me.id;
                }
            } catch {
                alert("Could not read current user ID.");
            }
        };

        const fetchTarget = async () => {
            setFetchingTarget(true);
            setTargetData(null);
            try {
                const data = await fetchDiscordUser(targetId);
                setTargetData(data);
                storage.storage.redirectTarget = targetId.trim();
            } catch (e) {
                alert(e.message);
            } finally {
                setFetchingTarget(false);
            }
        };

        const applyRedirect = () => {
            const src = sourceId.trim();
            const tgt = targetId.trim();
            if (!src || !tgt) {
                alert("Both Source and Target IDs are required.");
                return;
            }

            // Replace source ID → target ID everywhere (author.id redirect)
            upsertRule(src, tgt);

            if (targetData) {
                // Avatar: replace source avatar hash → target avatar hash
                if (targetData.avatar)
                    upsertRule(`${src}/avatar`, `${tgt}/avatar`);

                // Username
                if (targetData.username)
                    upsertRule(`__redirect_username_${src}`, targetData.username);

                // Global name
                if (targetData.global_name)
                    upsertRule(`__redirect_globalname_${src}`, targetData.global_name);

                // Avatar decoration
                const deco = targetData.avatar_decoration_data;
                if (deco?.asset)
                    upsertRule(`${src}/${deco.asset}`, `${tgt}/${deco.asset}`);

                // Nameplate
                const nameplate = targetData.collectibles?.nameplate;
                if (nameplate?.asset) {
                    const parts = nameplate.asset.replace("nameplates/", "").replace(/\/$/, "").split("/");
                    upsertRule(`${src}$${parts[0]}$${parts[1]}$${nameplate.palette ?? ""}`, "");
                }

                // Clan tag
                const clan = targetData.clan;
                if (clan?.tag)
                    upsertRule(`__redirect_clantag_${src}`, clan.tag);
            }

            storage.storage.redirectSource = src;
            storage.storage.redirectTarget = tgt;
            storage.storage.redirectEnabled = true;
            alert("Redirect applied! Rules saved.");
        };

        const clearRedirect = () => {
            const src = sourceId.trim();
            if (src) removeRule(src);
            storage.storage.redirectEnabled = false;
            setTargetData(null);
            alert("Redirect cleared.");
        };

        return React.createElement(
            ScrollView,
            { style: { flex: 1, backgroundColor: "#1e1f22" } },

            // ── CONFIGURATION ──
            React.createElement(Text, { style: S.section }, "Configuration"),

            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },

                React.createElement(Text, { style: S.inputLabel }, "Source User ID (Redirect FROM)"),
                React.createElement(TextInput, {
                    placeholder: "Your user ID…",
                    placeholderTextColor: "#4e5058",
                    value: sourceId,
                    onChangeText: setSourceId,
                    keyboardType: "numeric",
                    style: S.input,
                }),

                React.createElement(Text, { style: S.inputLabel }, "Target User ID (Redirect TO)"),
                React.createElement(TextInput, {
                    placeholder: "Target user ID…",
                    placeholderTextColor: "#4e5058",
                    value: targetId,
                    onChangeText: setTargetId,
                    keyboardType: "numeric",
                    style: S.input,
                }),

                // Fetch target button
                React.createElement(Btn, {
                    label: fetchingTarget ? "Fetching…" : "Fetch Target User Data",
                    onPress: fetchTarget,
                    style: { backgroundColor: "#5865f2" },
                }),

                // Fetched data preview
                targetData && React.createElement(
                    View,
                    { style: S.infoBox },
                    React.createElement(InfoRow, { label: "Username", value: targetData.username }),
                    React.createElement(InfoRow, { label: "Global Name", value: targetData.global_name }),
                    React.createElement(InfoRow, { label: "Avatar", value: targetData.avatar }),
                    React.createElement(InfoRow, { label: "Decoration", value: targetData.avatar_decoration_data?.asset }),
                    React.createElement(InfoRow, { label: "Nameplate", value: targetData.collectibles?.nameplate?.asset }),
                    React.createElement(InfoRow, { label: "Clan Tag", value: targetData.clan?.tag }),
                    React.createElement(InfoRow, { label: "Clan ID", value: targetData.clan?.identity_guild_id })
                )
            ),

            // ── STATUS ──
            React.createElement(Text, { style: S.section }, "Status"),
            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },
                React.createElement(FormSwitchRow, {
                    label: "Enable Redirect",
                    value: storage.storage.redirectEnabled,
                    onValueChange: (val) => (storage.storage.redirectEnabled = val),
                    style: { backgroundColor: "transparent", paddingHorizontal: 0 },
                })
            ),

            // ── ACTIONS ──
            React.createElement(Text, { style: S.section }, "Actions"),
            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },

                React.createElement(Btn, {
                    label: "Get My ID (Sets Source ID)",
                    onPress: getMyId,
                    style: { backgroundColor: "#4e5058", marginTop: 0 },
                }),

                React.createElement(Btn, {
                    label: "Apply Redirect",
                    onPress: applyRedirect,
                    style: { backgroundColor: "#23a55a" },
                }),

                React.createElement(Btn, {
                    label: "Clear Redirect",
                    onPress: clearRedirect,
                    style: { backgroundColor: "#f23f43" },
                })
            ),

            React.createElement(View, { style: { height: 40 } })
        );
    }

    // ─── Page: Name Changer ───────────────────────────────────────────────────────
    function NameChangerPage() {
        storage.useProxy(storage.storage);

        const [targetId, setTargetId] = React.useState(storage.storage.nameTargetId || "");
        const [alias, setAlias] = React.useState(storage.storage.nameAlias || "");
        const [fetching, setFetching] = React.useState(false);
        const [userData, setUserData] = React.useState(null);

        const fetchUser = async () => {
            setFetching(true);
            setUserData(null);
            try {
                const data = await fetchDiscordUser(targetId);
                setUserData(data);
                // Pre-fill alias with their current global name / username
                if (!alias) setAlias(data.global_name || data.username || "");
            } catch (e) {
                alert(e.message);
            } finally {
                setFetching(false);
            }
        };

        const save = () => {
            const id = targetId.trim();
            const name = alias.trim();
            if (!id || !name) {
                alert("Target User ID and New Name are required.");
                return;
            }
            // Replace their globalName and username with the alias
            upsertRule(`__namechanger_global_${id}`, name);
            upsertRule(`__namechanger_user_${id}`, name);
            storage.storage.nameTargetId = id;
            storage.storage.nameAlias = name;
            alert(`Alias "${name}" saved for ${id}.`);
        };

        const clear = () => {
            const id = targetId.trim();
            removeRule(`__namechanger_global_${id}`);
            removeRule(`__namechanger_user_${id}`);
            setAlias("");
            storage.storage.nameAlias = "";
            alert("Name alias cleared.");
        };

        return React.createElement(
            ScrollView,
            { style: { flex: 1, backgroundColor: "#1e1f22" } },

            React.createElement(Text, { style: S.section }, "Alias Settings"),

            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },

                React.createElement(Text, { style: S.inputLabel }, "Target User ID"),
                React.createElement(TextInput, {
                    placeholder: "User ID to rename…",
                    placeholderTextColor: "#4e5058",
                    value: targetId,
                    onChangeText: (v) => { setTargetId(v); storage.storage.nameTargetId = v; },
                    keyboardType: "numeric",
                    style: S.input,
                }),

                React.createElement(Btn, {
                    label: fetching ? "Fetching…" : "Look Up User",
                    onPress: fetchUser,
                    style: { backgroundColor: "#5865f2" },
                }),

                userData && React.createElement(
                    View,
                    { style: S.infoBox },
                    React.createElement(InfoRow, { label: "Username", value: userData.username }),
                    React.createElement(InfoRow, { label: "Global Name", value: userData.global_name }),
                    React.createElement(InfoRow, { label: "Decoration", value: userData.avatar_decoration_data?.asset }),
                    React.createElement(InfoRow, { label: "Nameplate", value: userData.collectibles?.nameplate?.asset }),
                    React.createElement(InfoRow, { label: "Clan Tag", value: userData.clan?.tag })
                ),

                React.createElement(View, { style: S.divider }),

                React.createElement(Text, { style: S.inputLabel }, "New Name (Alias)"),
                React.createElement(TextInput, {
                    placeholder: "Display name to show instead…",
                    placeholderTextColor: "#4e5058",
                    value: alias,
                    onChangeText: setAlias,
                    style: S.input,
                }),

                React.createElement(Btn, {
                    label: "Save Alias",
                    onPress: save,
                    style: { backgroundColor: "#23a55a" },
                }),

                React.createElement(Btn, {
                    label: "Clear Alias",
                    onPress: clear,
                    style: { backgroundColor: "#f23f43" },
                })
            ),

            React.createElement(View, { style: { height: 40 } })
        );
    }

    // ─── Page: Decoration Changer ─────────────────────────────────────────────────
    function DecorationChangerPage() {
        storage.useProxy(storage.storage);

        const [targetId, setTargetId] = React.useState(storage.storage.decoTargetId || "");
        const [assetId, setAssetId] = React.useState(storage.storage.decoAsset || "");
        const [skuId, setSkuId] = React.useState(storage.storage.decoSkuId || "");
        const [fetching, setFetching] = React.useState(false);
        const [userData, setUserData] = React.useState(null);

        const fetchUser = async () => {
            setFetching(true);
            setUserData(null);
            try {
                const data = await fetchDiscordUser(targetId);
                setUserData(data);
                // Auto-fill from their existing decoration data
                const deco = data.avatar_decoration_data;
                if (deco) {
                    if (!assetId) setAssetId(deco.asset || "");
                    if (!skuId) setSkuId(String(deco.sku_id || ""));
                }
            } catch (e) {
                alert(e.message);
            } finally {
                setFetching(false);
            }
        };

        const save = () => {
            const id = targetId.trim();
            const asset = assetId.trim();
            if (!id || !asset) {
                alert("Target User ID and Asset ID are required.");
                return;
            }
            // Encode as the "userId/assetId" format the patcher understands
            upsertRule(`${id}/${asset}`, `${id}/${asset}`);
            storage.storage.decoTargetId = id;
            storage.storage.decoAsset = asset;
            storage.storage.decoSkuId = skuId.trim();
            alert("Decoration saved.");
        };

        const clear = () => {
            const id = targetId.trim();
            const asset = assetId.trim();
            removeRule(`${id}/${asset}`);
            setAssetId("");
            setSkuId("");
            storage.storage.decoAsset = "";
            storage.storage.decoSkuId = "";
            alert("Decoration cleared.");
        };

        return React.createElement(
            ScrollView,
            { style: { flex: 1, backgroundColor: "#1e1f22" } },

            React.createElement(Text, { style: S.section }, "Decoration Settings"),

            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },

                React.createElement(Text, { style: S.inputLabel }, "Target User ID"),
                React.createElement(TextInput, {
                    placeholder: "User ID…",
                    placeholderTextColor: "#4e5058",
                    value: targetId,
                    onChangeText: (v) => { setTargetId(v); storage.storage.decoTargetId = v; },
                    keyboardType: "numeric",
                    style: S.input,
                }),

                React.createElement(Btn, {
                    label: fetching ? "Fetching…" : "Fetch User Decoration",
                    onPress: fetchUser,
                    style: { backgroundColor: "#5865f2" },
                }),

                userData && React.createElement(
                    View,
                    { style: S.infoBox },
                    React.createElement(InfoRow, { label: "Username", value: userData.username }),
                    React.createElement(InfoRow, { label: "Asset", value: userData.avatar_decoration_data?.asset }),
                    React.createElement(InfoRow, { label: "SKU ID", value: String(userData.avatar_decoration_data?.sku_id ?? "") }),
                    React.createElement(InfoRow, { label: "Nameplate", value: userData.collectibles?.nameplate?.asset }),
                    React.createElement(InfoRow, { label: "Palette", value: userData.collectibles?.nameplate?.palette })
                ),

                React.createElement(View, { style: S.divider }),

                React.createElement(Text, { style: S.inputLabel }, "Asset ID"),
                React.createElement(TextInput, {
                    placeholder: "a_1ffd338bf104b616ea…",
                    placeholderTextColor: "#4e5058",
                    value: assetId,
                    onChangeText: setAssetId,
                    autoCapitalize: "none",
                    style: S.input,
                }),

                React.createElement(Text, { style: S.inputLabel }, "SKU ID"),
                React.createElement(TextInput, {
                    placeholder: "1385050947834613820",
                    placeholderTextColor: "#4e5058",
                    value: skuId,
                    onChangeText: setSkuId,
                    keyboardType: "numeric",
                    style: S.input,
                }),

                React.createElement(Btn, {
                    label: "Save Decoration",
                    onPress: save,
                    style: { backgroundColor: "#23a55a" },
                }),

                React.createElement(Btn, {
                    label: "Clear Decoration",
                    onPress: clear,
                    style: { backgroundColor: "#f23f43" },
                })
            ),

            React.createElement(View, { style: { height: 40 } })
        );
    }

    // ─── Main Settings Page (nav hub) ─────────────────────────────────────────────
    function SettingsPage() {
        storage.useProxy(storage.storage);

        // Simple in-page navigation state since Vendetta's Navigator API varies by build
        const [page, setPage] = React.useState("home");

        if (page === "token") return React.createElement(SubPage, { title: "Auth Token", onBack: () => setPage("home"), Page: TokenSettingsPage });
        if (page === "redirector") return React.createElement(SubPage, { title: "Dynamic Profile Redirector", onBack: () => setPage("home"), Page: RedirectorPage });
        if (page === "name") return React.createElement(SubPage, { title: "Name Changer", onBack: () => setPage("home"), Page: NameChangerPage });
        if (page === "deco") return React.createElement(SubPage, { title: "Decoration Changer", onBack: () => setPage("home"), Page: DecorationChangerPage });

        const tokenSet = !!storage.storage.authToken;

        return React.createElement(
            ScrollView,
            { style: { flex: 1, backgroundColor: "#1e1f22" } },

            // Master toggle
            React.createElement(Text, { style: S.section }, "Global"),
            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6 }] },
                React.createElement(FormSwitchRow, {
                    label: "Enable all replacements",
                    value: storage.storage.enabled,
                    onValueChange: (val) => (storage.storage.enabled = val),
                    style: { backgroundColor: "transparent", paddingHorizontal: 0 },
                })
            ),

            // Token status
            React.createElement(Text, { style: S.section }, "Setup"),
            React.createElement(
                View,
                { style: [S.card, { borderRadius: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }] },
                React.createElement(
                    View,
                    null,
                    React.createElement(Text, { style: { color: "#dbdee1", fontSize: 15, fontWeight: "600" } }, "Auth Token"),
                    React.createElement(Text, { style: { color: tokenSet ? "#23a55a" : "#f23f43", fontSize: 12, marginTop: 2 } }, tokenSet ? "Token configured" : "Not set — required for API lookups")
                ),
                React.createElement(
                    Text,
                    { style: { color: "#5865f2", fontSize: 14, fontWeight: "600" }, onPress: () => setPage("token"), suppressHighlighting: true },
                    "Configure ›"
                )
            ),

            // Sub-pages
            React.createElement(Text, { style: S.section }, "Features"),

            NavCard({
                label: "Dynamic Profile Redirector",
                sub: "Redirect one user's profile to appear as another",
                badge: storage.storage.redirectEnabled ? "ON" : null,
                onPress: () => setPage("redirector"),
            }),

            NavCard({
                label: "Name Changer",
                sub: "Assign a local alias to any user",
                badge: storage.storage.nameAlias ? storage.storage.nameAlias : null,
                onPress: () => setPage("name"),
            }),

            NavCard({
                label: "Decoration Changer",
                sub: "Override a user's avatar decoration",
                badge: storage.storage.decoAsset ? "SET" : null,
                onPress: () => setPage("deco"),
            }),

            React.createElement(View, { style: { height: 40 } })
        );
    }

    // ─── Nav card ─────────────────────────────────────────────────────────────────
    function NavCard({ label, sub, badge, onPress }) {
        return React.createElement(
            View,
            {
                style: [
                    S.card,
                    {
                        borderRadius: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 4,
                    },
                ],
            },
            React.createElement(
                View,
                { style: { flex: 1 } },
                React.createElement(Text, { style: { color: "#dbdee1", fontSize: 15, fontWeight: "600" } }, label),
                sub && React.createElement(Text, { style: { color: "#8e9297", fontSize: 12, marginTop: 2 } }, sub)
            ),
            badge && React.createElement(
                View,
                { style: { backgroundColor: "#23a55a", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 } },
                React.createElement(Text, { style: { color: "#fff", fontSize: 11, fontWeight: "700" } }, badge)
            ),
            React.createElement(
                Text,
                { style: { color: "#5865f2", fontSize: 18 }, onPress, suppressHighlighting: true },
                "›"
            )
        );
    }

    // ─── Sub-page wrapper with back button ────────────────────────────────────────
    function SubPage({ title, onBack, Page }) {
        return React.createElement(
            View,
            { style: { flex: 1, backgroundColor: "#1e1f22" } },

            // Header
            React.createElement(
                View,
                {
                    style: {
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingTop: 16,
                        paddingBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "#2b2d31",
                    },
                },
                React.createElement(
                    Text,
                    {
                        style: { color: "#5865f2", fontSize: 16, marginRight: 16, fontWeight: "600" },
                        onPress: onBack,
                        suppressHighlighting: true,
                    },
                    "‹ Back"
                ),
                React.createElement(
                    Text,
                    { style: { color: "#dbdee1", fontSize: 17, fontWeight: "700", flex: 1 } },
                    title
                )
            ),

            React.createElement(Page, null)
        );
    }

    // ─── Patching ─────────────────────────────────────────────────────────────────
    function applyPatches() {
        const UserProfilePrimaryInfo = metro.findByName("UserProfilePrimaryInfo", false);
        const UserProfileAboutMeCard = metro.findByName("UserProfileAboutMeCard", false);
        const ChatViewWrapperBase = metro.findByName("ChatViewWrapperBase", false);
        const UserStore = metro.findByStoreName("UserStore");

        // Patch: getUser
        _unpatchers.push(
            patcher.after("getUser", UserStore, function ([userId], user) {
                if (!storage.storage.enabled) return;
                const rules = getCompiledRules();

                for (const rule of rules) {
                    const rawSource = rule.re.source.replaceAll("\\", "");

                    // Avatar decoration  →  "userId/assetId"
                    const avatarParts = rawSource.split("/");
                    if (avatarParts.length > 1 && avatarParts[0] === userId) {
                        user.avatarDecorationData = {
                            asset: avatarParts[1],
                            skuId: undefined,
                            expiresAt: null,
                        };
                    }

                    // Display name styles  →  "userId%fontId%effectId%...colors"
                    const styleParts = rawSource.split("%");
                    if (styleParts.length > 1 && styleParts[0] === userId) {
                        user.displayNameStyles = {
                            fontId: styleParts[1],
                            effectId: styleParts[2],
                            colors: styleParts.toSpliced(0, 3),
                        };
                    }

                    // Collectibles / nameplate  →  "userId$type$variant$palette"
                    const collectibleParts = rawSource.split("$");
                    if (collectibleParts.length > 1 && collectibleParts[0] === userId) {
                        user.collectibles = {
                            nameplate: {
                                asset: `nameplates/${collectibleParts[1]}/${collectibleParts[2]}/`,
                                skuId: undefined,
                                expiresAt: null,
                                label: undefined,
                                palette: collectibleParts[3],
                            },
                        };
                    }

                    // Primary guild tag
                    if (user?.primaryGuild?.tag) {
                        user.primaryGuild.tag = user.primaryGuild.tag.replace(rule.re, rule.to);
                    }
                }
            })
        );

        // Patch: RowManager.generate
        _unpatchers.push(
            patcher.before("generate", RowManager.prototype, function ([row]) {
                if (!storage.storage.enabled) return;
                try {
                    const rules = getCompiledRules();
                    for (const rule of rules) {
                        const msg = row?.message;
                        const author = msg?.author;

                        if (msg?.content)
                            msg.content = msg.content.replace(rule.re, rule.to);
                        if (author?.id)
                            author.id = author.id.replace(rule.re, rule.to);
                        if (author?.avatar)
                            author.avatar = author.avatar.replace(rule.re, rule.to);
                        if (author?.avatarDecorationData?.asset)
                            author.avatarDecorationData.asset = author.avatarDecorationData.asset.replace(rule.re, rule.to);
                        if (author?.primaryGuild?.tag)
                            author.primaryGuild.tag = author.primaryGuild.tag.replace(rule.re, rule.to);
                        if (author?.primaryGuild?.badge)
                            author.primaryGuild.badge = author.primaryGuild.badge.replace(rule.re, rule.to);
                        if (author?.primaryGuild?.identityGuildId)
                            author.primaryGuild.identityGuildId = author.primaryGuild.identityGuildId.replace(rule.re, rule.to);
                        if (author?.username)
                            author.username = author.username.replace(rule.re, rule.to);
                        if (author?.globalName)
                            author.globalName = author.globalName.replace(rule.re, rule.to);
                        if (msg?.attachments?.length) {
                            msg.attachments.forEach((att) => {
                                if (att.url?.match(rule.re)) {
                                    att.url = rule.to;
                                    att.proxy_url = rule.to;
                                }
                            });
                        }
                    }
                } catch {
                    // Silently ignore
                }
            })
        );

        // Patch: UserProfilePrimaryInfo
        _unpatchers.push(
            patcher.after("default", UserProfilePrimaryInfo, function (_args, result) {
                if (!storage.storage.enabled) return;
                try {
                    const rules = getCompiledRules();
                    for (const rule of rules) {
                        const tag = result?.props?.children[1]?.props?.children[0]?.props?.userTag;
                        if (tag)
                            result.props.children[1].props.children[0].props.userTag = tag.replace(rule.re, rule.to);
                    }
                } catch { }
            })
        );

        // Patch: UserProfileAboutMeCard
        _unpatchers.push(
            patcher.after("default", UserProfileAboutMeCard, function (_args, result) {
                if (!storage.storage.enabled) return;
                try {
                    const rules = getCompiledRules();
                    for (const rule of rules) {
                        const uid = result?.props?.children[1]?.props?.userId;
                        if (uid)
                            result.props.children[1].props.userId = uid.replace(rule.re, rule.to);
                    }
                } catch { }
            })
        );

        // Patch: ChatViewWrapperBase
        _unpatchers.push(
            patcher.after("default", ChatViewWrapperBase, function (_args, result) {
                if (!storage.storage.enabled) return;
                try {
                    const rules = getCompiledRules();
                    for (const rule of rules) {
                        const recipients = result.props.children.props.children
                            .filter(Boolean)[0]
                            .props.children.props.channel.recipients;
                        recipients.forEach((id, i) => {
                            recipients[i] = id.replace(rule.re, rule.to);
                        });
                    }
                } catch { }
            })
        );
    }

    // ─── Plugin Export ────────────────────────────────────────────────────────────
    const pluginExport = {
        settings: () => React.createElement(SettingsPage, null),

        onLoad() {
            console.log("[TextReplacer] onLoad");
            setTimeout(() => applyPatches(), 0);
        },

        onUnload() {
            console.log("[TextReplacer] onUnload");
            _unpatchers.forEach((fn) => fn?.());
            _unpatchers = [];
        },
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