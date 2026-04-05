function formatUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio,
    createdAt: user.created_at
  };
}

module.exports = { formatUser };
