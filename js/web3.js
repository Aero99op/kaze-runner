// Web3 / Wallet / Claim Reward system
let web3Provider = null;
let web3Signer = null;
let walletConnected = false;
let userAddress = '';

// Bind event listeners when the script runs (loaded after DOM is parsing/parsed)
window.addEventListener('DOMContentLoaded', () => {
    const walletBtn = document.getElementById('walletBtn');
    if (walletBtn) {
        walletBtn.onclick = async () => {
            if (!window.ethereum) {
                alert('MetaMask required!');
                return;
            }
            try {
                web3Provider = new ethers.BrowserProvider(window.ethereum);
                await web3Provider.send('eth_requestAccounts', []);
                web3Signer = await web3Provider.getSigner();
                userAddress = await web3Signer.getAddress();
                
                walletBtn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
                walletBtn.classList.add('connected');
                walletConnected = true;

                // Enable claim button if game is already over
                const cb = document.getElementById('btnClaim');
                if (cb) {
                    cb.disabled = (!walletConnected || totalCoins === 0);
                }
            } catch (e) {
                console.error(e);
            }
        };
    }

    // Dummy listener for contract address input to prevent errors
    const contractAddr = document.getElementById('contractAddr');
    if (contractAddr) {
        contractAddr.oninput = () => {};
    }

    const btnClaim = document.getElementById('btnClaim');
    if (btnClaim) {
        btnClaim.onclick = async () => {
            if (!walletConnected || totalCoins === 0 || !userAddress) return;
            const st = document.getElementById('txStatus');
            btnClaim.disabled = true;
            btnClaim.textContent = 'Requesting…';
            st.style.color = '#a78bfa';
            st.textContent = 'Contacting reward server…';
            try {
                const response = await fetch(`${BACKEND_URL}/reward`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: userAddress, coins: totalCoins })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Server error occurred.');
                }
                st.style.color = '#6ee7b7';
                st.innerHTML = `Claimed ${(totalCoins * 0.0001).toFixed(4)} ETH! <a href="https://sepolia.etherscan.io/tx/${data.txHash}" target="_blank">View tx ↗</a>`;
                totalCoins = 0;
                if (typeof updateHUD === 'function') updateHUD();
            } catch (e) {
                console.error(e);
                btnClaim.disabled = false;
                btnClaim.textContent = 'Claim ETH';
                st.style.color = '#f87171';
                st.textContent = e.message || 'Transaction failed. Is server running?';
            }
        };
    }
});
