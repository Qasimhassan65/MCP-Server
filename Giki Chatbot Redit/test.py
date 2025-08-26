import praw
import json

OUTPUT_FILE = "giki_fetched_posts.json"

# reddit = praw.Reddit(
#     client_id="aCrV2pWoR7GPxm8KICr1pw",
#     client_secret="Q4ytoBuBF-8uYyw1IWJpXB8BD7xHvg",
#     refresh_token="667760271790-Bg-PiidfGhe6p7Lxy6uFyl-FDRcJ-g",
#     user_agent="GIKI-RAG-Bot by u/Unknown_694"
# )

subreddit = reddit.subreddit("giki")
all_posts = []

for post in subreddit.new(limit=None):
    post_data = {
        "id": post.id,
        "title": post.title,
        "selftext": post.selftext,
        "author": str(post.author),
        "created_utc": post.created_utc,
        "comments": []
    }
    
    post.comments.replace_more(limit=None)
    for comment in post.comments.list():
        post_data["comments"].append({
            "id": comment.id,
            "body": comment.body,
            "author": str(comment.author),
            "created_utc": comment.created_utc
        })
    
    all_posts.append(post_data)

    # Save progress incrementally
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_posts, f, ensure_ascii=False, indent=2)

print(f"Saved {len(all_posts)} posts to {OUTPUT_FILE}")