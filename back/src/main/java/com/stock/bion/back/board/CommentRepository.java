package com.stock.bion.back.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByPostIdAndParentIsNullOrderByIdAsc(Long postId);
    List<Comment> findByParentIdOrderByIdAsc(Long parentId);
}
