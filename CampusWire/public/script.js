class CampusBuzz {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentUser = null;
        this.posts = [];
        this.currentFilter = 'all';
        this._followers = [];
        this._following = [];
        this.init();
    }

    async init() {
        if (!this.token) {
            window.location.href = '/login.html';
            return;
        }

        await this.loadCurrentUser();
        await this.loadFollowCounts();
        await this.loadTheme();
        await this.loadFeed();
        this.setupEventListeners();
        this.updateUI();
    }

    async apiCall(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            ...options
        };

        try {
            const response = await fetch(endpoint, config);
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    throw new Error('Session expired');
                }
                throw new Error(data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            this.showToast(error.message, 'error');
            throw error;
        }
    }

    async loadCurrentUser() {
    try {
        // Use the verify-token endpoint to get user data
        const data = await this.apiCall('/auth/verify-token');
        this.currentUser = data.user;
        this.updateUserInfo();
    } catch (error) {
        console.error('Failed to load user:', error);
        this.logout();
    }
    }

    async decodeToken() {
        try {
            const response = await this.apiCall('/auth/verify', { method: 'GET' });
            return response.user;
        } catch (error) {
            throw new Error('Failed to verify token');
        }
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        document.getElementById('userName').textContent = this.currentUser.name;
        document.getElementById('userDept').textContent = 
            `${this.currentUser.dept} • Year ${this.currentUser.year}`;
        document.getElementById('warningCount').textContent = this.currentUser.warning_count;
        this.loadFollowCounts();

        if (this.currentUser.role === 'Admin') {
            document.body.classList.add('user-admin');
        }
    }

    async loadTheme() {
        try {
            const data = await this.apiCall('/theme/current');
            const banner = document.getElementById('themeBanner');
            const festivalName = document.getElementById('festivalName');
            const festivalDates = document.getElementById('festivalDates');

            if (data.active) {
                const theme = data.theme;
                banner.style.background = `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})`;
                festivalName.textContent = theme.festival_name;
                festivalDates.textContent = 
                    `${new Date(theme.start_date).toLocaleDateString()} - ${new Date(theme.end_date).toLocaleDateString()}`;
                
                // Apply theme to CSS variables
                document.documentElement.style.setProperty('--primary-color', theme.primary_color);
                document.documentElement.style.setProperty('--secondary-color', theme.secondary_color);
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
    }

    async loadFeed() {
    try {
        const data = await this.apiCall('/posts/');
        this.posts = data;
        this.renderPosts();
        this.updateStats();
        
        // Load reactions for each post
        this.posts.forEach(post => {
            this.loadReactions(post.post_id);
        });
    } catch (error) {
        console.error('Failed to load feed:', error);
    }
    }

    async loadLikeCounts() {
        // This would typically load like counts from your backend
        // For now, we'll simulate it
        this.posts.forEach(post => {
            const likeCount = document.getElementById(`like-count-${post.post_id}`);
            if (likeCount) {
                likeCount.textContent = post.like_count || Math.floor(Math.random() * 50);
            }
        });
    }
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
    async createPost() {
        const content = document.getElementById('postContent').value.trim();
        const emotion = document.getElementById('postEmotion').value;
        const imageInput = document.getElementById('postImage');
        
        if (!content) {
            this.showToast('Please write something to post', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('content', content);
        formData.append('emotion', emotion);
        
        if (imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
        }

        try {
            const response = await fetch('/posts/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error);
            }

            this.showToast('Post created successfully!', 'success');
            document.getElementById('postContent').value = '';
            document.getElementById('postImage').value = '';
            document.getElementById('imagePreview').innerHTML = '';
            
            await this.loadFeed();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }
    renderPosts() {
        const container = document.getElementById('feedPosts');
        const filteredPosts = this.currentFilter === 'all' 
            ? this.posts 
            : this.posts.filter(post => post.emotion === this.currentFilter);

        if (filteredPosts.length === 0) {
            container.innerHTML = `
                <div class="no-posts">
                    <i class="fas fa-comments" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                    <h3>No posts found</h3>
                    <p>Be the first to share something with the campus community!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredPosts.map(post => this.createPostHTML(post)).join('');
        this.updatePostFollowButtons();
    }
async updatePostFollowButtons() {
    if (!this.currentUser) return;

    const userId = this.currentUser.user_id;

    const following = await fetch(`/follow/following/${userId}`, {
        headers: { "Authorization": `Bearer ${this.token}` }
    }).then(r => r.json());

    const followingList = following.following || [];

    this.posts.forEach(post => {
        const btn = document.getElementById(`follow-btn-post-${post.user_id}`);
        if (!btn) return;

        if (post.user_id === userId) {
            btn.style.display = "none";
            return;
        }

        const already = followingList.includes(post.user_id);

        btn.textContent = already ? "Unfollow" : "Follow";
        btn.classList.toggle("following", already);
    });
}



    createPostHTML(post) {
    const emotionClass = `emotion-${post.emotion.toLowerCase()}`;
    const timeAgo = this.getTimeAgo(new Date(post.created_at));
    
    return `
        <div class="post-card" data-post-id="${post.post_id}">
            <div class="post-header">
                <div class="post-user">
                    <div class="user-avatar-small">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="user-details">
                        <h4>${post.name}</h4>
                        <button class="post-follow-btn" onclick="app.followOrUnfollow('${post.user_id}')" id="follow-btn-post-${post.user_id}">
                        <div class="post-meta">${timeAgo}</div>
                    </div>
                </div>
                <span class="post-emotion ${emotionClass}">${post.emotion}</span>
            </div>
            
            <div class="post-content">
                <p>${this.escapeHTML(post.content)}</p>
            </div>
            
            ${post.image_path ? `
                <div class="post-image">
                    <img src="${post.image_path}" alt="Post image" onerror="this.style.display='none'">
                </div>
            ` : ''}
            
            <!-- Reactions Stats -->
            <div class="post-stats" id="stats-${post.post_id}">
                <div class="reactions-count" id="reactions-${post.post_id}" onclick="app.showLikesModal(${post.post_id})">
                    <!-- Reactions will be loaded here -->
                </div>
                <div class="comments-count"
     id="comments-count-${post.post_id}"
     onclick="app.toggleComments(${post.post_id})">

                    <!-- Comment count will be loaded here -->
                </div>
            </div>
            
            <!-- Post Actions -->
            <div class="post-actions-bar">
                <div class="reaction-btn-container">
                    <!-- Main Like Button (Toggle) -->
                    <button class="action-btn like-btn" onclick="app.toggleLike(${post.post_id})" 
                            id="like-btn-${post.post_id}" data-current-reaction="">
                        <i class="far fa-thumbs-up"></i>
                        <span>Like</span>
                    </button>
                    
                    <!-- Reaction Picker (for different reactions) -->
                    <div class="reactions-picker" id="reactions-picker-${post.post_id}">
                        <button class="reaction-option" data-reaction="like" title="Like">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <button class="reaction-option" data-reaction="love" title="Love">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="reaction-option" data-reaction="funny" title="Funny">
                            <i class="fas fa-laugh"></i>
                        </button>
                        <button class="reaction-option" data-reaction="insightful" title="Insightful">
                            <i class="fas fa-lightbulb"></i>
                        </button>
                    </div>
                </div>
                
                <button class="action-btn comment-btn" onclick="app.toggleComments(${post.post_id})">
                    <i class="far fa-comment"></i>
                    <span>Comment</span>
                </button>
            </div>
            
            <div class="comments-section" id="comments-${post.post_id}" style="display: none;">
                <div class="comment-input">
                    <input type="text" id="comment-${post.post_id}" placeholder="Write a comment..." onkeypress="if(event.key==='Enter') app.addComment(${post.post_id})">
                    <button onclick="app.addComment(${post.post_id})">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="comment-list" id="comment-list-${post.post_id}">
                    <!-- Comments will be loaded here -->
                </div>
            </div>
        </div>
    `;
}
    async loadReactions(postId) {
        try {
            const data = await this.apiCall(`/react/reactions/${postId}`);
            this.updateReactionsUI(postId, data);
            this.loadCommentCount(postId); // ADD THIS LINE
        } catch (error) {
            console.error('Failed to load reactions:', error);
        }
    }
    async loadCommentCount(postId) {
        try {
            const data = await this.apiCall(`/react/comments-count/${postId}`);
            const commentsCount = document.getElementById(`comments-count-${postId}`);
            
            if (data.comment_count > 0) {
                commentsCount.innerHTML = `
                    <span class="comments-count-text">
                        ${data.comment_count} ${data.comment_count === 1 ? 'comment' : 'comments'}
                    </span>
                `;
            } else {
                commentsCount.innerHTML = '';
            }
        } catch (error) {
            console.error('Failed to load comment count:', error);
        }
    }

    async showLikesModal(postId) {
        try {
            const likes = await this.apiCall(`/react/likes/${postId}`);
            
            const modal = document.getElementById('likesModal');
            const likesList = document.getElementById('likesList');
            
            if (likes.length === 0) {
                likesList.innerHTML = `
                    <div class="no-likes">
                        <i class="far fa-thumbs-up"></i>
                        <p>No reactions yet</p>
                        <small>Be the first to react!</small>
                    </div>
                `;
            } else {
                likesList.innerHTML = likes.map(like => `
                    <div class="like-item">
                        <div class="user-avatar-small">
                            <i class="fas fa-user-circle"></i>
                        </div>
                        <div class="like-details">
                            <strong>${like.name}</strong>
                            <div class="reaction-type">
                                <i class="${this.getReactionIcon(like.reaction_type)}" style="color: ${this.getReactionColor(like.reaction_type)}"></i>
                                ${this.getReactionText(like.reaction_type)}
                            </div>
                            <small>${this.getTimeAgo(new Date(like.created_at))}</small>
                        </div>
                    </div>
                `).join('');
            }
            
            modal.style.display = 'block';
        } catch (error) {
            console.error('Failed to load likes:', error);
        }
    }

    getReactionIcon(reactionType) {
        const icons = {
            like: 'fas fa-thumbs-up',
            love: 'fas fa-heart',
            funny: 'fas fa-laugh',
            insightful: 'fas fa-lightbulb'
        };
        return icons[reactionType] || 'fas fa-thumbs-up';
    }

    getReactionColor(reactionType) {
        const colors = {
            like: '#007bff',
            love: '#e0245e',
            funny: '#ffad1f',
            insightful: '#17bf63'
        };
        return colors[reactionType] || '#007bff';
    }

getReactionText(reactionType) {
    const texts = {
        like: 'Liked',
        love: 'Loved',
        funny: 'Found funny',
        insightful: 'Found insightful'
    };
    return texts[reactionType] || 'Liked';
}

updateReactionsUI(postId, reactionData) {
    const reactionsContainer = document.getElementById(`reactions-${postId}`);
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    
    if (!reactionsContainer) return;
    
    // Update reaction counts
    const totalReactions = reactionData.counts.reduce((sum, r) => sum + parseInt(r.count), 0);
    
    if (totalReactions > 0) {
        const topReactions = reactionData.counts.slice(0, 3);
        const reactionIcons = {
            like: 'fas fa-thumbs-up',
            love: 'fas fa-heart',
            funny: 'fas fa-laugh',
            insightful: 'fas fa-lightbulb'
        };
        
        reactionsContainer.innerHTML = `
            <div class="reactions-display" onclick="app.showLikesModal(${postId})">
                <div class="reaction-icons">
                    ${topReactions.map(reaction => `
                        <i class="${reactionIcons[reaction.reaction_type]}" style="color: ${
                            reaction.reaction_type === 'like' ? '#007bff' :
                            reaction.reaction_type === 'love' ? '#e0245e' :
                            reaction.reaction_type === 'funny' ? '#ffad1f' : '#17bf63'
                        }"></i>
                    `).join('')}
                </div>
                <span class="reactions-text">
                    ${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}
                </span>
            </div>
        `;
    } else {
        reactionsContainer.innerHTML = '';
    }
    
    // Update like button based on user's reaction
    if (reactionData.userReaction) {
        const reactionType = reactionData.userReaction.reaction_type;
        const buttonTexts = {
            like: 'Liked',
            love: 'Loved', 
            funny: 'Funny',
            insightful: 'Insightful'
        };
        
        const buttonColors = {
            like: '#007bff',
            love: '#e0245e', 
            funny: '#ffad1f',
            insightful: '#17bf63'
        };
        
        likeBtn.innerHTML = `
            <i class="${this.getReactionIcon(reactionType)}"></i>
            <span>${buttonTexts[reactionType]}</span>
        `;
        likeBtn.style.color = buttonColors[reactionType];
        likeBtn.dataset.currentReaction = reactionType;
        likeBtn.classList.add('active');
    } else {
        likeBtn.innerHTML = `
            <i class="far fa-thumbs-up"></i>
            <span>Like</span>
        `;
        likeBtn.style.color = '';
        likeBtn.dataset.currentReaction = '';
        likeBtn.classList.remove('active');
    }
}

async toggleLike(postId) {
    try {
        const likeBtn = document.getElementById(`like-btn-${postId}`);
        const currentReaction = likeBtn.dataset.currentReaction;
        
        // If user already liked, unlike. Otherwise, like.
        const newReaction = currentReaction ? 'unlike' : 'like';
        
        const response = await this.apiCall('/react/react', {
            method: 'POST',
            body: JSON.stringify({ 
                post_id: postId, 
                reaction_type: newReaction === 'unlike' ? currentReaction : 'like'
            })
        });
        
        // Reload reactions to update UI
        await this.loadReactions(postId);
        
        // Show appropriate toast
        if (response.action === 'added') {
            this.showToast('Liked', 'success');
        } else if (response.action === 'removed') {
            this.showToast('Like removed', 'info');
        }
        
    } catch (error) {
        console.error('Failed to toggle like:', error);
    }
}

// Keep the reaction picker for different reaction types
showReactions(postId) {
    const picker = document.getElementById(`reactions-picker-${postId}`);
    picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
    
    // Hide other pickers
    document.querySelectorAll('.reactions-picker').forEach(p => {
        if (p.id !== `reactions-picker-${postId}`) {
            p.style.display = 'none';
        }
    });
}

async reactToPost(postId, reactionType) {
    try {
        const likeBtn = document.getElementById(`like-btn-${postId}`);
        const currentReaction = likeBtn.dataset.currentReaction;
        
        // If clicking the same reaction type, unlike it. Otherwise, apply new reaction.
        const actionType = (currentReaction === reactionType) ? 'unlike' : 'like';
        
        const response = await this.apiCall('/react/react', {
            method: 'POST',
            body: JSON.stringify({ 
                post_id: postId, 
                reaction_type: actionType === 'unlike' ? currentReaction : reactionType
            })
        });
        
        // Hide picker
        document.getElementById(`reactions-picker-${postId}`).style.display = 'none';
        
        // Reload reactions to update UI
        await this.loadReactions(postId);
        
        // Show appropriate toast
        if (response.action === 'added') {
            const toastMessages = {
                like: 'Liked',
                love: 'Loved • Great!',
                funny: 'Haha • Funny!', 
                insightful: 'Insightful • Thanks for sharing!'
            };
            this.showToast(toastMessages[reactionType], 'success');
        } else if (response.action === 'removed') {
            this.showToast('Reaction removed', 'info');
        } else if (response.action === 'updated') {
            const toastMessages = {
                like: 'Liked',
                love: 'Loved • Great!',
                funny: 'Haha • Funny!', 
                insightful: 'Insightful • Thanks for sharing!'
            };
            this.showToast(toastMessages[reactionType], 'success');
        }
        
    } catch (error) {
        console.error('Failed to react:', error);
    }
}
async likePost(postId) {
    try {
        const likeBtn = document.getElementById(`like-btn-${postId}`);
        const likeIcon = likeBtn.querySelector('i');
        const likeText = likeBtn.querySelector('span');
        const likeCount = document.getElementById(`like-count-${postId}`);
        
        // Immediate visual feedback
        likeIcon.className = 'fas fa-heart';
        likeText.textContent = 'Liked';
        likeBtn.classList.add('liked');
        
        // Update count immediately
        const currentCount = parseInt(likeCount.textContent) || 0;
        likeCount.textContent = currentCount + 1;
        
        // Send API request
        await this.apiCall('/react/like', {
            method: 'POST',
            body: JSON.stringify({ post_id: postId })
        });
        
        // Show LinkedIn-style toast
        this.showToast('Liked • Insightful', 'success');
        
    } catch (error) {
        // Revert if failed
        const likeBtn = document.getElementById(`like-btn-${postId}`);
        const likeIcon = likeBtn.querySelector('i');
        const likeText = likeBtn.querySelector('span');
        const likeCount = document.getElementById(`like-count-${postId}`);
        
        likeIcon.className = 'far fa-heart';
        likeText.textContent = 'Like';
        likeBtn.classList.remove('liked');
        
        const currentCount = parseInt(likeCount.textContent) || 0;
        if (currentCount > 0) {
            likeCount.textContent = currentCount - 1;
        }
        
        console.error('Failed to like post:', error);
    }
}
    

async addComment(postId) {
    const commentInput = document.getElementById(`comment-${postId}`);
    const comment = commentInput.value.trim();
    
    if (!comment) {
        this.showToast('Please write a comment', 'warning');
        return;
    }

    try {
        await this.apiCall('/react/comment', {
            method: 'POST',
            body: JSON.stringify({ 
                post_id: postId, 
                comment: comment 
            })
        });
        
        this.showToast('Comment added!', 'success');
        commentInput.value = '';
        
        // FIX: Actually reload comments instead of just toggling
        await this.loadComments(postId);
        
    } catch (error) {
        console.error('Failed to add comment:', error);
    }
}
async loadFollowCounts() {
    const userId = this.currentUser.user_id;

    const followers = await fetch(`/follow/followers/${userId}`, {
        headers: { "Authorization": `Bearer ${this.token}` }
    }).then(r => r.json());

    const following = await fetch(`/follow/following/${userId}`, {
        headers: { "Authorization": `Bearer ${this.token}` }
    }).then(r => r.json());

    this._followers = followers.followers || [];
    this._following = following.following || [];

    document.getElementById("followersCount").textContent = this._followers.length;
    document.getElementById("followingCount").textContent = this._following.length;
}



async followOrUnfollow(targetId) {
    console.log("FOLLOW CLICKED", targetId);
    
    const already = this._following.includes(targetId);

    if (already) {
        // CHANGE THIS ENDPOINT
        await fetch(`/follow/unfollow/${targetId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`
            }
            // REMOVE body: JSON.stringify({ userId })
        });

        this._following = this._following.filter(id => id !== targetId);

    } else {
        // CHANGE THIS ENDPOINT  
        await fetch(`/follow/follow/${targetId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`
            }
            // REMOVE body: JSON.stringify({ userId })
        });

        this._following.push(targetId);
    }

    await this.loadFollowCounts();
    this.updatePostFollowButtons();
}





openFollowers() {
    const modal = document.getElementById("followModal");
    document.getElementById("followModalTitle").textContent = "Followers";

    document.getElementById("followList").innerHTML =
        this._followers.length === 0
        ? "<p>No followers yet</p>"
        : this._followers.map(id => `
            <div class="user-item">
                <i class="fas fa-user-circle"></i> User ${id}
            </div>
        `).join("");

    modal.style.display = "block";
}

openFollowing() {
    const modal = document.getElementById("followModal");
    document.getElementById("followModalTitle").textContent = "Following";

    document.getElementById("followList").innerHTML =
        this._following.length === 0
        ? "<p>Not following anyone</p>"
        : this._following.map(id => `
            <div class="user-item">
                <i class="fas fa-user-circle"></i> User ${id}
            </div>
        `).join("");

    modal.style.display = "block";
}


async loadComments(postId) {
    const commentList = document.getElementById(`comment-list-${postId}`);
    commentList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>Loading comments...</p></div>';
    
    try {
        const comments = await this.apiCall(`/react/comments/${postId}`);
        
        if (comments.length === 0) {
            commentList.innerHTML = `
                <div class="no-comments">
                    <i class="far fa-comments"></i>
                    <p>No comments yet</p>
                    <small>Be the first to comment!</small>
                </div>
            `;
        } else {
            commentList.innerHTML = comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-avatar">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <strong class="comment-author">${comment.username || 'User'}</strong>
                            <span class="comment-time">${this.getTimeAgo(new Date(comment.created_at))}</span>
                        </div>
                        <div class="comment-text">${this.escapeHTML(comment.comment_text)}</div>
                        <div class="comment-actions">
                            <button class="comment-like-btn" onclick="app.likeComment(${comment.reaction_id})">
                                <i class="far fa-heart"></i>
                                <span>Like</span>
                            </button>
                            <button class="comment-reply-btn">
                                <i class="far fa-comment"></i>
                                <span>Reply</span>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load comments:', error);
        commentList.innerHTML = `
            <div class="error-comments">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load comments</p>
            </div>
        `;
    }
}

toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const isVisible = commentsSection.style.display !== 'none';
    
    commentsSection.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        this.loadComments(postId);
    }
}


    updateStats() {
        document.getElementById('totalPosts').textContent = this.posts.length;
        
        // Calculate active users (this would normally come from an API)
        const activeUsers = new Set(this.posts.map(post => post.user_id)).size;
        document.getElementById('activeUsers').textContent = activeUsers;
        
        this.updateEmotionTrends();
    }

    updateEmotionTrends() {
        const emotionCounts = {};
        this.posts.forEach(post => {
            emotionCounts[post.emotion] = (emotionCounts[post.emotion] || 0) + 1;
        });

        const trendsContainer = document.getElementById('emotionTrends');
        const sortedEmotions = Object.entries(emotionCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        if (sortedEmotions.length === 0) {
            trendsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No data yet</p>';
            return;
        }

        trendsContainer.innerHTML = sortedEmotions.map(([emotion, count]) => `
            <div class="trending-item">
                <span>${emotion}</span>
                <span class="count">${count}</span>
            </div>
        `).join('');
    }

    setupEventListeners() {
        // Post submission
        document.getElementById('submitPost').addEventListener('click', () => this.createPost());
        
        // Image preview
        document.getElementById('postImage').addEventListener('change', (e) => {
            this.previewImage(e.target);
        });

        // Emotion filters
        document.querySelectorAll('.emotion-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.emotion-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.emotion;
                this.renderPosts();
            });
        });
// Reaction buttons event delegation
// Reaction buttons event delegation (for different reaction types)
document.addEventListener('click', (e) => {
    if (e.target.closest('.reaction-option')) {
        const option = e.target.closest('.reaction-option');
        const postId = option.closest('.reactions-picker').id.split('-')[2];
        const reactionType = option.dataset.reaction;
        app.reactToPost(postId, reactionType);
    }
});
document.getElementById("followersCount").parentElement.onclick = () => this.openFollowers();
document.getElementById("followingCount").parentElement.onclick = () => this.openFollowing();

// document.getElementById("followBtn").onclick = () =>
//     this.followOrUnfollow(this.profileUserId || this.currentUser.user_id);


// Close reaction pickers when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.reaction-btn-container')) {
        document.querySelectorAll('.reactions-picker').forEach(picker => {
            picker.style.display = 'none';
        });
    }
});
        // Navigation
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.getElementById('adminLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAdminModal();
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchAdminTab(tabName);
            });
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    previewImage(input) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';

        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                preview.appendChild(img);
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    switchAdminTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`${tabName}Tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Load tab data
        if (tabName === 'users') this.loadUsers();
        if (tabName === 'posts') this.loadFlaggedPosts();
        if (tabName === 'themes') this.loadThemes();
    }

    async loadUsers() {
        try {
            const users = await this.apiCall('/admin/users');
            const container = document.getElementById('usersList');
            
            container.innerHTML = users.map(user => `
                <div class="admin-item">
                    <div class="user-details">
                        <h4>${user.name}</h4>
                        <p>${user.email} • ${user.dept} Year ${user.year}</p>
                        <p>Role: ${user.role} • Warnings: ${user.warning_count}</p>
                        <p>Status: ${user.is_active ? 'Active' : 'Inactive'} • Verified: ${user.is_verified ? 'Yes' : 'No'}</p>
                    </div>
                    <div class="admin-actions-buttons">
                        ${user.is_active ? 
                            `<button class="btn btn-deactivate" onclick="app.deactivateUser(${user.user_id})">Deactivate</button>` :
                            `<button class="btn btn-activate" onclick="app.activateUser(${user.user_id})">Activate</button>`
                        }
                        <button class="btn btn-warn" onclick="app.warnUser(${user.user_id})">Warn</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    async loadFlaggedPosts() {
        try {
            const posts = await this.apiCall('/admin/flagged-posts');
            const container = document.getElementById('flaggedPostsList');
            
            container.innerHTML = posts.map(post => `
                <div class="admin-item">
                    <div class="user-details">
                        <h4>${post.name} (${post.email})</h4>
                        <p>${post.content}</p>
                        <p>Posted: ${new Date(post.created_at).toLocaleString()}</p>
                    </div>
                    <div class="admin-actions-buttons">
                        <button class="btn btn-delete" onclick="app.deletePost(${post.post_id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load flagged posts:', error);
        }
    }

    async loadThemes() {
        try {
            const themes = await this.apiCall('/admin/themes');
            const container = document.getElementById('themesList');
            
            container.innerHTML = themes.map(theme => `
                <div class="admin-item">
                    <div class="user-details">
                        <h4>${theme.festival_name}</h4>
                        <p>${new Date(theme.start_date).toLocaleDateString()} - ${new Date(theme.end_date).toLocaleDateString()}</p>
                        <p>Colors: ${theme.primary_color} / ${theme.secondary_color}</p>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load themes:', error);
        }
    }

    async deactivateUser(userId) {
        if (!confirm('Are you sure you want to deactivate this user?')) return;
        
        try {
            await this.apiCall('/admin/user/deactivate', {
                method: 'POST',
                body: JSON.stringify({ user_id: userId })
            });
            this.showToast('User deactivated', 'success');
            this.loadUsers();
        } catch (error) {
            console.error('Failed to deactivate user:', error);
        }
    }

    async activateUser(userId) {
        try {
            await this.apiCall('/admin/user/reactivate', {
                method: 'POST',
                body: JSON.stringify({ user_id: userId })
            });
            this.showToast('User activated', 'success');
            this.loadUsers();
        } catch (error) {
            console.error('Failed to activate user:', error);
        }
    }

    async warnUser(userId) {
        const reason = prompt('Enter warning reason:');
        if (!reason) return;
        
        try {
            await this.apiCall('/admin/user/warn', {
                method: 'POST',
                body: JSON.stringify({ 
                    user_id: userId, 
                    reason: reason 
                })
            });
            this.showToast('Warning issued', 'success');
            this.loadUsers();
        } catch (error) {
            console.error('Failed to warn user:', error);
        }
    }

    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) return;
        
        try {
            await this.apiCall('/admin/post/delete', {
                method: 'POST',
                body: JSON.stringify({ post_id: postId })
            });
            this.showToast('Post deleted', 'success');
            this.loadFlaggedPosts();
        } catch (error) {
            console.error('Failed to delete post:', error);
        }
    }

    showAdminModal() {
        document.getElementById('adminModal').style.display = 'block';
        this.switchAdminTab('users');
    }

    showAddThemeForm() {
        document.getElementById('themeModal').style.display = 'block';
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    logout() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }

    updateUI() {
        // Additional UI updates can go here
    }
}

// Global functions for HTML onclick handlers
function showCreatePost() {
    document.getElementById('postContent').focus();
}

function refreshFeed() {
    app.loadFeed();
}

function searchUsers() {
    // Implement user search
    const query = document.getElementById('userSearch').value;
    console.log('Searching for:', query);
}

function goToChats() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return alert("Please log in!");

  window.location.href = `http://localhost:3000?user_id=${user.user_id}&name=${encodeURIComponent(user.name)}`;
}



// Initialize app
window.app = new CampusBuzz();
