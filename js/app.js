// 聊天应用逻辑
$(document).ready(function() {
    // 服务器地址
    const SERVER_URL = 'http://127.0.0.1:9602';
    
    // DOM元素
    // 登录界面元素
    const loginContainer = $('#loginContainer');
    const loginEmail = $('#loginEmail');
    const loginBtn = $('#loginBtn');
    
    // 验证相关元素
    const emailStep = $('#emailStep');
    const codeStep = $('#codeStep');
    const sendCodeBtn = $('#sendCodeBtn');
    const verificationCode = $('#verificationCode');
    const verifyBtn = $('#verifyBtn');
    const resendBtn = $('#resendBtn');
    const backBtn = $('#backBtn');
    const displayEmail = $('#displayEmail');
    const countdownText = $('#countdownText');
    
    // 聊天界面元素
    const chatContainer = $('#chatContainer');
    const currentUser = $('#currentUser');
    const chatMessages = $('#chatMessages');
    const messageInput = $('#message');
    const sendBtn = $('#sendBtn');
    const clearChatBtn = $('#clearChatBtn');
    const clearMemoryBtn = $('#clearMemoryBtn');
    const logoutBtn = $('#logoutBtn');
    
    // 当前用户信息
    let currentUserEmail = '';
    let isFirstChat = false;
    let useMCP = false; // MCP模式开关状态
    let includeThinking = true; // 推理链开关状态（默认开启）
    let isWaiting = false; // 正在等待AI回复或开场白
    
    // 验证相关状态
    let countdownTimer = null;
    let canResendCode = true;

    // Toast 提示函数
    function showToast(message, type = 'info', duration = 3000) {
        const container = $('#toastContainer');
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        const toast = $(`
            <div class="toast ${type}">
                <span class="toast-icon">${icons[type]}</span>
                <span>${message}</span>
            </div>
        `);
        container.append(toast);
        setTimeout(() => {
            toast.css('animation', 'toastOut 0.4s ease forwards');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    function setWaiting(waiting) {
        isWaiting = waiting;
        sendBtn.prop('disabled', waiting);
        messageInput.prop('disabled', waiting);
    }
    
    // 发送验证码按钮点击事件
    sendCodeBtn.on('click', function() {
        sendVerificationCode();
    });
    
    // 回车键发送验证码
    loginEmail.on('keypress', function(e) {
        if (e.which === 13) {
            sendVerificationCode();
        }
    });
    
    // 验证按钮点击事件
    verifyBtn.on('click', function() {
        verifyEmailCode();
    });
    
    // 回车键验证
    verificationCode.on('keypress', function(e) {
        if (e.which === 13) {
            verifyEmailCode();
        }
    });
    
    // 重新发送验证码
    resendBtn.on('click', function() {
        sendVerificationCode();
    });
    
    // 返回上一步
    backBtn.on('click', function() {
        showEmailStep();
    });
    
    // 发送验证码函数
    function sendVerificationCode() {
        const email = loginEmail.val().trim();
        
        if (!email) {
            showToast('请输入邮箱！', 'warning');
            return;
        }
        
        if (!canResendCode) {
            showToast('请等待倒计时结束后再发送！', 'warning');
            return;
        }
        
        sendCodeBtn.prop('disabled', true);
        sendCodeBtn.text('发送中...');
        
        $.ajax({
            url: `${SERVER_URL}/auth/send-verification`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email: email }),
            success: function(response) {
                sendCodeBtn.prop('disabled', false);
                sendCodeBtn.text('发送验证码');
                
                if (response.success) {
                    showVerificationStep(email);
                    startCountdown();
                    showToast('验证码已发送，请查看您的邮箱！', 'success');
                } else {
                    showToast(response.error || '发送失败，请重试', 'error');
                }
            },
            error: function(xhr, status, error) {
                sendCodeBtn.prop('disabled', false);
                sendCodeBtn.text('发送验证码');
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : '发送失败，请检查网络连接';
                showToast(errorMsg, 'error');
                console.error('发送验证码失败:', error);
            }
        });
    }
    
    // 验证邮箱验证码函数
    function verifyEmailCode() {
        const email = loginEmail.val().trim();
        const code = verificationCode.val().trim();
        
        if (!email || !code) {
            showToast('请输入邮箱和验证码！', 'warning');
            return;
        }
        
        verifyBtn.prop('disabled', true);
        verifyBtn.text('验证中...');
        
        $.ajax({
            url: `${SERVER_URL}/auth/verify`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email: email, code: code }),
            success: function(response) {
                verifyBtn.prop('disabled', false);
                verifyBtn.text('验证');
                
                if (response.success) {
                    currentUserEmail = email;
                    
                    // 保存邮箱到localStorage
                    if (typeof(Storage) !== "undefined") {
                        localStorage.setItem('userEmail', email);
                    }
                    
                    // 清除倒计时
                    clearInterval(countdownTimer);
                    
                    // 切换到聊天界面
                    loginContainer.hide();
                    chatContainer.show();
                    currentUser.text(`当前用户: ${email}`);
                    
                    // 加载聊天记录
                    loadChatHistory();
                    
                    // 检查是否是首次聊天
                    checkFirstChat();
                } else {
                    showToast(response.error || '验证失败，请重试', 'error');
                }
            },
            error: function(xhr, status, error) {
                verifyBtn.prop('disabled', false);
                verifyBtn.text('验证');
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : '验证失败，请检查网络连接';
                showToast(errorMsg, 'error');
                console.error('验证失败:', error);
            }
        });
    }
    
    // 显示验证步骤
    function showVerificationStep(email) {
        emailStep.hide();
        codeStep.show();
        displayEmail.text(email);
        verificationCode.val('');
        verificationCode.focus();
    }
    
    // 显示邮箱步骤
    function showEmailStep() {
        codeStep.hide();
        emailStep.show();
        loginEmail.focus();
        clearInterval(countdownTimer);
        countdownText.text('');
    }
    
    // 开始倒计时
    function startCountdown() {
        canResendCode = false;
        let seconds = 60;
        
        countdownTimer = setInterval(function() {
            if (seconds <= 0) {
                clearInterval(countdownTimer);
                countdownText.text('');
                resendBtn.prop('disabled', false);
                canResendCode = true;
            } else {
                countdownText.text(`重新发送 (${seconds}s)`);
                resendBtn.prop('disabled', true);
                seconds--;
            }
        }, 1000);
    }
    
    // 发送按钮点击事件
    sendBtn.on('click', function() {
        sendMessage();
    });
    
    // 回车键发送消息
    messageInput.on('keypress', function(e) {
        if (e.which === 13) {
            sendMessage();
        }
    });
    
    // 发送消息函数
    function sendMessage() {
        const message = messageInput.val().trim();
        
        if (!message) return;
        if (isWaiting) return;
        
        // 显示用户消息
        addMessage('user', message);
        
        // 保存到聊天记录
        saveChatHistory('user', message);
        
        // 清空输入框
        messageInput.val('');
        
        // 发送请求到服务器
        sendRequest(currentUserEmail, message);
    }
    
    // 发送请求到服务器
    function sendRequest(email, message) {
        // 显示加载状态
        const loadingMessage = addMessage('ai', '<div class="loading"></div>');
        setWaiting(true);
        
        let url = `${SERVER_URL}/chat`;
        let requestData = {
            email: email,
            message: message,
            include_thinking: includeThinking,
            raw: includeThinking
        };
        
        // 如果是MCP模式，调整请求格式
        if (useMCP) {
            url = `${SERVER_URL}/mcp/chat`;
            requestData = {
                jsonrpc: "2.0",
                method: "chat",
                params: {
                    email: email,
                    message: message,
                    include_thinking: includeThinking
                },
                id: Date.now() // 使用时间戳作为请求ID
            };
        }
        
        // 发送AJAX请求
        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(requestData),
            success: function(response) {
                loadingMessage.remove();
                setWaiting(false);
                let aiResponse = '';
                let thinkingText = '';
                if (useMCP) {
                    aiResponse = response.result ? response.result.response : '';
                    thinkingText = response.result ? (response.result.thinking || '') : '';
                } else {
                    aiResponse = response.response;
                    thinkingText = response.thinking || '';
                }
                const aiGroup = addMessage('ai', aiResponse);
                if (thinkingText) {
                    addThinkingToGroup(aiGroup, thinkingText);
                }
                saveChatHistory('ai', aiResponse);
            },
            error: function(xhr, status, error) {
                // 移除加载状态
                loadingMessage.remove();
                setWaiting(false);
                
                // 检查是否需要重新验证
                if (xhr.status === 401 && xhr.responseJSON && xhr.responseJSON.need_verification) {
                    showToast('邮箱验证已失效，请重新验证', 'warning');
                    handleLogout();
                    return;
                }
                
                // 显示错误信息
                const errorMsg = '抱歉，我现在有点忙，稍后再聊吧～';
                addMessage('ai', errorMsg);
                saveChatHistory('ai', errorMsg);
                console.error('请求失败:', error);
            }
        });
    }
    
    // 添加消息到聊天窗口
    function addMessage(type, content) {
        // 创建消息组
        const messageGroup = $('<div>').addClass('message-group');
        
        // 如果是AI消息，处理括号内的神态描述
        if (type === 'ai') {
            // 正则表达式：匹配括号内的神态描述 (内容) 或（全角）
            const expressionRegex = /\(([^)]+)\)|（([^）]+)）/g;
            let match;
            let lastIndex = 0;
            let expressions = [];
            
            // 提取所有神态描述
            while ((match = expressionRegex.exec(content)) !== null) {
                expressions.push({
                    text: match[1] || match[2],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
            
            // 如果没有神态描述，直接添加完整消息
            if (expressions.length === 0) {
                const messageDiv = $('<div>').addClass('message').addClass('ai-message');
                messageDiv.html(content);
                messageGroup.append(messageDiv);
            } else {
                // 按顺序添加对话内容和神态描述
                for (let i = 0; i < expressions.length; i++) {
                    const exp = expressions[i];
                    
                    // 添加神态描述前的对话内容
                    if (exp.start > lastIndex) {
                        const textContent = content.substring(lastIndex, exp.start);
                        if (textContent.trim()) {
                            const messageDiv = $('<div>').addClass('message').addClass('ai-message');
                            messageDiv.html(textContent);
                            messageGroup.append(messageDiv);
                        }
                    }
                    
                    // 添加神态描述
                    const expressionDiv = $('<div>').addClass('expression');
                    expressionDiv.text(exp.text);
                    messageGroup.append(expressionDiv);
                    
                    lastIndex = exp.end;
                }
                
                // 添加最后一个神态描述后的对话内容
                if (lastIndex < content.length) {
                    const textContent = content.substring(lastIndex);
                    if (textContent.trim()) {
                        const messageDiv = $('<div>').addClass('message').addClass('ai-message');
                        messageDiv.html(textContent);
                        messageGroup.append(messageDiv);
                    }
                }
            }
        } else {
            const markerRegex = /\(\(([\s\S]+?)\)\)|（（([\s\S]+?)））|\[\[([\s\S]+?)\]\]|【([\s\S]+?)】/g;
            let match;
            let lastIndex = 0;
            let hasMarkers = false;
            while ((match = markerRegex.exec(content)) !== null) {
                hasMarkers = true;
                const start = match.index;
                const end = start + match[0].length;
                if (start > lastIndex) {
                    const textContent = content.substring(lastIndex, start);
                    if (textContent.trim()) {
                        const messageDiv = $('<div>').addClass('message').addClass('user-message');
                        messageDiv.text(textContent);
                        messageGroup.append(messageDiv);
                    }
                }
                const thoughtText = match[1] || match[2];
                const actionText = match[3] || match[4];
                if (thoughtText) {
                    const thoughtDiv = $('<div>').addClass('thought');
                    thoughtDiv.text(thoughtText);
                    messageGroup.append(thoughtDiv);
                } else if (actionText) {
                    const actionDiv = $('<div>').addClass('action');
                    actionDiv.text(actionText);
                    messageGroup.append(actionDiv);
                }
                lastIndex = end;
            }
            if (!hasMarkers) {
                const messageDiv = $('<div>').addClass('message').addClass('user-message');
                messageDiv.text(content);
                messageGroup.append(messageDiv);
            } else if (lastIndex < content.length) {
                const textContent = content.substring(lastIndex);
                if (textContent.trim()) {
                    const messageDiv = $('<div>').addClass('message').addClass('user-message');
                    messageDiv.text(textContent);
                    messageGroup.append(messageDiv);
                }
            }
        }
        
        // 将消息组添加到聊天窗口
        chatMessages.append(messageGroup);
        
        // 滚动到底部
        scrollToBottom();
        
        return messageGroup;
    }
    
    // 添加推理链到消息组（折叠展示）
    function addThinkingToGroup(group, thinking) {
        if (!thinking) return;
        const container = $('<div>').addClass('thinking-container');
        const toggle = $('<div>').addClass('thinking-toggle').text('查看/收起推理过程');
        const content = $('<div>').addClass('thinking-content').css('display', 'none');
        content.text(thinking);
        toggle.on('click', function() { content.toggle(); });
        container.append(toggle);
        container.append(content);
        group.append(container);
    }
    
    // 滚动到底部
    function scrollToBottom() {
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
    }
    
    // 加载聊天记录
    function loadChatHistory() {
        // 从后端获取聊天记录
        $.ajax({
            url: `${SERVER_URL}/chat/history`,
            type: 'GET',
            data: {
                email: currentUserEmail
            },
            success: function(response) {
                if (response.chat_history && response.chat_history.length > 0) {
                    // 清空现有聊天记录
                    chatMessages.empty();
                    
                    // 显示从后端获取的聊天记录
                    response.chat_history.forEach(chat => {
                        addMessage('user', chat.user_message);
                        addMessage('ai', chat.assistant_message);
                    });
                    
                    // 更新localStorage
                    updateLocalStorage(response.chat_history);
                } else {
                    isFirstChat = true;
                    sendWelcomePrompt();
                    
                    // 检查localStorage中是否有历史记录
                    if (typeof(Storage) !== "undefined") {
                        const chatHistoryKey = `chatHistory_${currentUserEmail}`;
                        const chatHistory = localStorage.getItem(chatHistoryKey);
                        
                        if (chatHistory) {
                            const messages = JSON.parse(chatHistory);
                            messages.forEach(msg => {
                                addMessage(msg.type, msg.content);
                            });
                        }
                    }
                }
            },
            error: function(xhr, status, error) {
                console.error('获取聊天记录失败:', error);
                isFirstChat = true;
                
                // 从localStorage获取聊天记录
                if (typeof(Storage) !== "undefined") {
                    const chatHistoryKey = `chatHistory_${currentUserEmail}`;
                    const chatHistory = localStorage.getItem(chatHistoryKey);
                    
                    if (chatHistory) {
                        const messages = JSON.parse(chatHistory);
                        messages.forEach(msg => {
                            addMessage(msg.type, msg.content);
                        });
                    }
                }
            }
        });
    }
    
    // 更新localStorage中的聊天记录
    function updateLocalStorage(chatHistory) {
        if (typeof(Storage) !== "undefined") {
            const chatHistoryKey = `chatHistory_${currentUserEmail}`;
            let localMessages = [];
            
            // 转换后端聊天记录格式为前端格式
            chatHistory.forEach(chat => {
                localMessages.push({
                    type: 'user',
                    content: chat.user_message,
                    timestamp: chat.created_at
                });
                localMessages.push({
                    type: 'ai',
                    content: chat.assistant_message,
                    timestamp: chat.created_at
                });
            });
            
            // 保存到localStorage
            localStorage.setItem(chatHistoryKey, JSON.stringify(localMessages));
        }
    }
    
    // 保存聊天记录
    function saveChatHistory(type, content) {
        if (typeof(Storage) !== "undefined") {
            const chatHistoryKey = `chatHistory_${currentUserEmail}`;
            let chatHistory = [];
            
            // 获取现有聊天记录
            const existingHistory = localStorage.getItem(chatHistoryKey);
            if (existingHistory) {
                chatHistory = JSON.parse(existingHistory);
            }
            
            // 添加新消息
            chatHistory.push({
                type: type,
                content: content,
                timestamp: new Date().toISOString()
            });
            
            // 限制聊天记录数量（最多保存100条）
            if (chatHistory.length > 100) {
                chatHistory = chatHistory.slice(-100);
            }
            
            // 保存到localStorage
            localStorage.setItem(chatHistoryKey, JSON.stringify(chatHistory));
        }
    }
    
    // 检查是否是首次聊天
    function checkFirstChat() {
        if (isFirstChat) {
            // 首次聊天，发送隐性提示词获取欢迎语
            sendWelcomePrompt();
        }
    }
    
    // 发送欢迎提示词（后端开场白接口）
    function sendWelcomePrompt() {
        const loadingMessage = addMessage('ai', '<div class="loading"></div>');
        setWaiting(true);
        $.ajax({
            url: `${SERVER_URL}/chat/initial`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email: currentUserEmail }),
            success: function(response) {
                loadingMessage.remove();
                setWaiting(false);
                if (response.status === 'success' && response.response) {
                    const aiGroup = addMessage('ai', response.response);
                    if (response.thinking) { addThinkingToGroup(aiGroup, response.thinking); }
                    saveChatHistory('ai', response.response);
                } else {
                    // 已有历史或未返回内容时不处理
                }
            },
            error: function(xhr, status, error) {
                loadingMessage.remove();
                setWaiting(false);
                const defaultWelcome = '你好，我是智子，很高兴为你服务！';
                addMessage('ai', defaultWelcome);
                saveChatHistory('ai', defaultWelcome);
                console.error('请求失败:', error);
            }
        });
    }
    
    // 浏览器兼容性检测
    function checkBrowserCompatibility() {
        // 检测是否支持XMLHttpRequest（IE7+支持）
        if (!window.XMLHttpRequest) {
            showToast('您的浏览器版本过低，请使用现代浏览器访问！', 'warning');
        }
        
        // 检测是否支持localStorage
        if (typeof(Storage) !== "undefined") {
            // 自动填充上次登录的邮箱
            const savedEmail = localStorage.getItem('userEmail');
            if (savedEmail) {
                loginEmail.val(savedEmail);
            }
        }
    }
    
    // 清空聊天记录按钮点击事件
    clearChatBtn.on('click', function() {
        clearChatHistory();
    });
    
    // 清空记忆按钮点击事件
    clearMemoryBtn.on('click', function() {
        clearMemory();
    });
    
    // 退出登录按钮点击事件
    logoutBtn.on('click', function() {
        handleLogout();
    });
    
    // 清空聊天记录函数
    function clearChatHistory() {
        if (confirm('确定要清空所有聊天记录吗？此操作不可恢复。')) {
            // 清空界面消息
            chatMessages.empty();
            
            // 清空localStorage中的聊天记录
            if (typeof(Storage) !== "undefined") {
                const chatHistoryKey = `chatHistory_${currentUserEmail}`;
                localStorage.removeItem(chatHistoryKey);
            }
            
            // 调用后端API清空数据库中的聊天记录
            $.ajax({
                url: `${SERVER_URL}/chat/history/clear`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    email: currentUserEmail
                }),
                success: function(response) {
                    console.log('聊天记录已清空:', response);
                    showToast('聊天记录已成功清空！', 'success');
                },
                error: function(xhr, status, error) {
                    console.error('清空聊天记录失败:', error);
                    showToast('清空聊天记录失败，请稍后重试。', 'error');
                }
            });
        }
    }
    
    // 清空记忆函数（清空后展示开场白）
    function clearMemory() {
        if (confirm('确定要清空所有记忆吗？此操作不可恢复。')) {
            setWaiting(true);
            $.ajax({
                url: `${SERVER_URL}/memory/clear`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ email: currentUserEmail }),
                success: function(response) {
                    console.log('记忆已清空:', response);
                    showToast('记忆已成功清空！', 'success');
                    const initMsg = response.initial_message;
                    if (initMsg) {
                        const aiGroup = addMessage('ai', initMsg);
                        saveChatHistory('ai', initMsg);
                    }
                    setWaiting(false);
                },
                error: function(xhr, status, error) {
                    console.error('清空记忆失败:', error);
                    showToast('清空记忆失败，请稍后重试。', 'error');
                    setWaiting(false);
                }
            });
        }
    }
    
    // 退出登录函数
    function handleLogout() {
        if (confirm('确定要退出登录吗？')) {
            // 清空当前用户信息
            currentUserEmail = '';
            isFirstChat = false;
            useMCP = false;
            includeThinking = true;
            isWaiting = false;
            
            // 清除倒计时
            clearInterval(countdownTimer);
            countdownText.text('');
            canResendCode = true;
            
            // 清空聊天记录
            chatMessages.empty();
            
            // 切换回登录界面
            chatContainer.hide();
            loginContainer.show();
            showEmailStep();
            
            // 清空输入框
            loginEmail.val('');
            verificationCode.val('');
            messageInput.val('');
            
            // 重置按钮状态
            sendCodeBtn.prop('disabled', false);
            sendCodeBtn.text('发送验证码');
            verifyBtn.prop('disabled', false);
            verifyBtn.text('验证');
            resendBtn.prop('disabled', false);
            
            // 重置状态
            setWaiting(false);
            
            // 重新检测浏览器兼容性，以便自动填充上次登录的邮箱
            checkBrowserCompatibility();
        }
    }
    
    // 初始化浏览器兼容性检测
    checkBrowserCompatibility();
    
    // 默认开启推理链并同步到UI
    includeThinking = true;
    $('#thinkingToggle').prop('checked', true);
    
    // MCP模式切换开关事件监听
    $('#mcpToggle').on('change', function() {
        useMCP = $(this).prop('checked');
        console.log('MCP模式已' + (useMCP ? '开启' : '关闭'));
    });
    $('#thinkingToggle').on('change', function() {
        includeThinking = $(this).prop('checked');
        console.log('推理链已' + (includeThinking ? '开启' : '关闭'));
    });
});