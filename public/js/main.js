const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allusersHtml = document.getElementById("allusers");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("end-call-btn");
const socket = io();

let localStream;
let caller = [];

// Peer Connection Singleton
const PeerConnection = (function () {
    let peerConnection;

    const createPeerConnection = () => {
        const config = {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
            ],
        };
        peerConnection = new RTCPeerConnection(config);

        // Add local stream to peer connection
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Listen to remote stream and add to remote video
        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        // Listen for ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("icecandidate", event.candidate);
            }
        };

        return peerConnection;
    };

    return {
        getInstance: () => {
            if (!peerConnection) {
                peerConnection = createPeerConnection();
            }
            return peerConnection;
        },
    };
})();

// Handle browser events
createUserBtn.addEventListener("click", (e) => {
    if (username.value !== "") {
        const usernameContainer = document.querySelector(".username-input");
        const localUsernameLabel = document.querySelector(".local-video .username-label");

        // Emit the username to the server
        socket.emit("join-user", username.value);

        // Hide the username input field
        usernameContainer.style.display = "none";

        // Display the local username label
        localUsernameLabel.textContent = username.value;
        localUsernameLabel.style.display = "block";
    } else {
        alert("Please enter a username!");
    }
});

endCallBtn.addEventListener("click", () => {
    socket.emit("call-ended", caller);
});

// Handle socket events
socket.on("joined", (allusers) => {
    console.log({ allusers });
    const createUsersHtml = () => {
        allusersHtml.innerHTML = "";

        for (const user in allusers) {
            const li = document.createElement("li");
            li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

            if (user !== username.value) {
                const button = document.createElement("button");
                button.classList.add("call-btn");
                button.addEventListener("click", () => {
                    startCall(user);
                });
                const img = document.createElement("img");
                img.setAttribute("src", "/images/phone.png");
                img.setAttribute("width", 20);

                button.appendChild(img);

                li.appendChild(button);
            }

            allusersHtml.appendChild(li);
        }
    };

    createUsersHtml();
});

socket.on("offer", async ({ from, to, offer }) => {
    const pc = PeerConnection.getInstance();
    // set remote description
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { from, to, answer: pc.localDescription });

    // Show remote username for person 2's video call
    const remoteUsernameLabel = document.querySelector(".remote-video .username-label");
    remoteUsernameLabel.textContent = from; // Show the caller's name
    remoteUsernameLabel.style.display = "block"; // Ensure the remote label is visible
});


socket.on("answer", async ({ from, to, answer }) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(answer);
    // show end call button
    endCallBtn.style.display = 'block';

    // Update the local and remote video user names when a connection is established
    const localUsernameLabel = document.querySelector(".local-video .username-label");
    localUsernameLabel.textContent = from; // Update local user's name

    const remoteUsernameLabel = document.querySelector(".remote-video .username-label");
    remoteUsernameLabel.textContent = to; // Update remote user's name

    localUsernameLabel.style.display = "block"; // Show the local username label
    remoteUsernameLabel.style.display = "block"; // Show the remote username label

    socket.emit("end-call", { from, to });
    caller = [from, to];
});


socket.on("icecandidate", async (candidate) => {
    console.log({ candidate });
    const pc = PeerConnection.getInstance();
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("end-call", ({ from, to }) => {
    endCallBtn.style.display = "block";
});

socket.on("call-ended", () => {
    endCall();
});

// Start call method
const startCall = async (user) => {
    console.log({ user });
    const pc = PeerConnection.getInstance();
    const offer = await pc.createOffer();
    console.log({ offer });
    
    await pc.setLocalDescription(offer);
    socket.emit("offer", { from: username.value, to: user, offer: pc.localDescription });

    // Update the remote username label for the caller's screen
    const remoteUsernameLabel = document.querySelector(".remote-video .username-label");
    remoteUsernameLabel.textContent = user; // Display the remote user's name
    remoteUsernameLabel.style.display = "block"; // Show the label
};

// End call method
const endCall = () => {
    const pc = PeerConnection.getInstance();
    if (pc) {
        pc.close();
        endCallBtn.style.display = "none";
    }
};

// Initialize local video
const startMyVideo = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        console.log({ stream });
        localStream = stream;
        localVideo.srcObject = stream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
};

startMyVideo();
