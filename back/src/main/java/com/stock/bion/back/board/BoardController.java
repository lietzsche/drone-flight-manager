package com.stock.bion.back.board;

import com.stock.bion.back.board.dto.CreateCommentRequest;
import com.stock.bion.back.board.dto.CreatePostRequest;
import com.stock.bion.back.board.dto.UpdatePostRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/boards")
@RequiredArgsConstructor
public class BoardController {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;

    @PostMapping
    public ResponseEntity<?> createPost(@RequestBody CreatePostRequest request, Authentication authentication) {
        if (request == null || request.title() == null || request.title().isBlank() ||
                request.content() == null || request.content().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "title and content are required"));
        }
        Post post = new Post();
        post.setTitle(request.title());
        post.setContent(request.content());
        post.setAuthor(authentication.getName());
        Post saved = postRepository.save(post);
        return ResponseEntity.created(URI.create("/api/boards/" + saved.getId())).body(saved);
    }

    @GetMapping
    public List<Post> listPosts() {
        return postRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPost(@PathVariable Long id) {
        Optional<Post> post = postRepository.findById(id);
        if (post.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return ResponseEntity.ok(post.get());
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updatePost(@PathVariable Long id,
                                        @RequestBody UpdatePostRequest request,
                                        Authentication authentication) {
        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Post post = postOpt.get();
        if (!post.getAuthor().equals(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (request.title() != null && !request.title().isBlank()) post.setTitle(request.title());
        if (request.content() != null && !request.content().isBlank()) post.setContent(request.content());
        return ResponseEntity.ok(postRepository.save(post));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePost(@PathVariable Long id, Authentication authentication) {
        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Post post = postOpt.get();
        if (!post.getAuthor().equals(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        // delete comments (and nested replies) first due to FK
        List<Comment> roots = commentRepository.findByPostIdAndParentIsNullOrderByIdAsc(id);
        for (Comment root : roots) {
            deleteRepliesDepthFirst(root.getId());
            commentRepository.delete(root);
        }
        postRepository.delete(post);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{postId}/comments")
    public ResponseEntity<?> listComments(@PathVariable Long postId) {
        if (!postRepository.existsById(postId)) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return ResponseEntity.ok(commentRepository.findByPostIdAndParentIsNullOrderByIdAsc(postId));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long postId,
                                        @RequestBody CreateCommentRequest request,
                                        Authentication authentication) {
        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        if (request == null || request.content() == null || request.content().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "content is required"));
        }
        Comment c = new Comment();
        c.setPost(postOpt.get());
        c.setContent(request.content());
        c.setAuthor(authentication.getName());
        Comment saved = commentRepository.save(c);
        return ResponseEntity.created(URI.create("/api/boards/" + postId + "/comments/" + saved.getId())).body(saved);
    }

    @GetMapping("/{postId}/comments/{commentId}/replies")
    public ResponseEntity<?> listReplies(@PathVariable Long postId, @PathVariable Long commentId) {
        // Ensure both post and parent comment exist
        if (!postRepository.existsById(postId)) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Optional<Comment> parentOpt = commentRepository.findById(commentId);
        if (parentOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Comment parent = parentOpt.get();
        if (parent.getPost() == null || !postId.equals(parent.getPost().getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "comment does not belong to post"));
        }
        return ResponseEntity.ok(commentRepository.findByParentIdOrderByIdAsc(commentId));
    }

    @PostMapping("/{postId}/comments/{commentId}/replies")
    public ResponseEntity<?> addReply(@PathVariable Long postId,
                                      @PathVariable Long commentId,
                                      @RequestBody CreateCommentRequest request,
                                      Authentication authentication) {
        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Optional<Comment> parentOpt = commentRepository.findById(commentId);
        if (parentOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Comment parent = parentOpt.get();
        if (parent.getPost() == null || !postId.equals(parent.getPost().getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "comment does not belong to post"));
        }
        if (request == null || request.content() == null || request.content().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "content is required"));
        }
        Comment reply = new Comment();
        reply.setPost(postOpt.get());
        reply.setParent(parent);
        reply.setContent(request.content());
        reply.setAuthor(authentication.getName());
        Comment saved = commentRepository.save(reply);
        return ResponseEntity.created(URI.create("/api/boards/" + postId + "/comments/" + commentId + "/replies/" + saved.getId())).body(saved);
    }

    @DeleteMapping("/{postId}/comments/{id}")
    public ResponseEntity<?> deleteComment(@PathVariable Long postId,
                                           @PathVariable Long id,
                                           Authentication authentication) {
        Optional<Comment> commentOpt = commentRepository.findById(id);
        if (commentOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Comment comment = commentOpt.get();
        if (comment.getPost() == null || !postId.equals(comment.getPost().getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "comment does not belong to post"));
        }
        if (!comment.getAuthor().equals(authentication.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        // delete all nested replies first (recursive)
        deleteRepliesDepthFirst(id);
        commentRepository.delete(comment);
        return ResponseEntity.noContent().build();
    }

    // naive DFS deletion of replies
    private void deleteRepliesDepthFirst(Long parentId) {
        List<Comment> replies = commentRepository.findByParentIdOrderByIdAsc(parentId);
        for (Comment r : replies) {
            deleteRepliesDepthFirst(r.getId());
            commentRepository.delete(r);
        }
    }
}
