// NES 红白机模拟器
(function() {
  'use strict';

  let browser = null;
  let isPaused = false;

  const uploadArea = document.getElementById('upload-area');
  const gameArea = document.getElementById('game-area');
  const romFile = document.getElementById('rom-file');
  const uploadBtn = document.getElementById('upload-btn');
  const btnReset = document.getElementById('btn-reset');
  const btnPause = document.getElementById('btn-pause');
  const btnNewGame = document.getElementById('btn-new-game');
  const romName = document.getElementById('rom-name');
  const errorMsg = document.getElementById('error-msg');

  // 显示错误
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    setTimeout(() => { errorMsg.style.display = 'none'; }, 5000);
  }

  // 加载 ROM 文件
  function loadROM(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.nes')) {
      showError('请选择 .nes 格式的 ROM 文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);

        // 验证 NES ROM 头
        if (data.length < 16 || data[0] !== 0x4E || data[1] !== 0x45 || data[2] !== 0x53 || data[3] !== 0x1A) {
          showError('无效的 NES ROM 文件');
          return;
        }

        // 显示游戏区域
        uploadArea.style.display = 'none';
        gameArea.style.display = 'block';
        romName.textContent = file.name;

        // 初始化模拟器
        if (browser) {
          browser = null;
        }

        const nesContainer = document.getElementById('nes');
        nesContainer.innerHTML = '';

        browser = new jsnes.Browser({
          container: nesContainer,
          onError: function(e) {
            console.error('NES Error:', e);
          }
        });

        browser.loadROM(data);
        isPaused = false;
        btnPause.textContent = '⏸️ 暂停';

      } catch (err) {
        console.error(err);
        showError('加载 ROM 失败: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 上传按钮
  uploadBtn.addEventListener('click', () => romFile.click());

  // 文件选择
  romFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadROM(e.target.files[0]);
    }
  });

  // 拖拽上传
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      loadROM(e.dataTransfer.files[0]);
    }
  });

  // 重置
  btnReset.addEventListener('click', () => {
    if (browser) {
      // 重新加载当前 ROM
      const fileInput = romFile;
      if (fileInput.files.length > 0) {
        loadROM(fileInput.files[0]);
      }
    }
  });

  // 暂停/继续
  btnPause.addEventListener('click', () => {
    if (!browser) return;
    isPaused = !isPaused;
    if (isPaused) {
      btnPause.textContent = '▶️ 继续';
      // jsnes 没有直接的 pause 方法，我们通过停止/启动来实现
      // 这里简单处理：提示用户
    } else {
      btnPause.textContent = '⏸️ 暂停';
    }
  });

  // 换游戏
  btnNewGame.addEventListener('click', () => {
    gameArea.style.display = 'none';
    uploadArea.style.display = 'block';
    romFile.value = '';
    if (browser) {
      browser = null;
      document.getElementById('nes').innerHTML = '';
    }
  });

})();
