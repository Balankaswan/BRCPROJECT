package com.transport.management.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/health")
@CrossOrigin(origins = "*")
public class HealthController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        
        try {
            // Test MongoDB connection
            mongoTemplate.getCollectionNames();
            
            health.put("status", "OK");
            health.put("timestamp", LocalDateTime.now().toString());
            health.put("database", "MongoDB Connected");
            health.put("server", "Spring Boot Transport Management System");
            health.put("version", "1.0.0");
            health.put("lanIP", "192.168.1.3");
            health.put("port", "8080");
            
            return ResponseEntity.ok(health);
        } catch (Exception e) {
            health.put("status", "ERROR");
            health.put("timestamp", LocalDateTime.now().toString());
            health.put("database", "MongoDB Connection Failed: " + e.getMessage());
            health.put("error", e.getMessage());
            
            return ResponseEntity.status(500).body(health);
        }
    }
}
