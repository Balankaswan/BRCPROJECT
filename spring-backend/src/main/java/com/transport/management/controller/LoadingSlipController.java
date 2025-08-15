package com.transport.management.controller;

import com.transport.management.model.LoadingSlip;
import com.transport.management.repository.LoadingSlipRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/loading-slips")
@CrossOrigin(origins = "*")
public class LoadingSlipController {

    @Autowired
    private LoadingSlipRepository loadingSlipRepository;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Get all loading slips
    @GetMapping
    public ResponseEntity<List<LoadingSlip>> getAllLoadingSlips() {
        List<LoadingSlip> loadingSlips = loadingSlipRepository.findAllByOrderByCreatedAtDesc();
        return ResponseEntity.ok(loadingSlips);
    }

    // Get loading slip by ID
    @GetMapping("/{id}")
    public ResponseEntity<LoadingSlip> getLoadingSlipById(@PathVariable String id) {
        Optional<LoadingSlip> loadingSlip = loadingSlipRepository.findById(id);
        return loadingSlip.map(ResponseEntity::ok)
                         .orElse(ResponseEntity.notFound().build());
    }

    // Create new loading slip
    @PostMapping
    public ResponseEntity<?> createLoadingSlip(@Valid @RequestBody LoadingSlip loadingSlip) {
        try {
            // Check if slip number already exists
            if (loadingSlipRepository.existsBySlipNumber(loadingSlip.getSlipNumber())) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Loading slip with number " + loadingSlip.getSlipNumber() + " already exists");
                return ResponseEntity.badRequest().body(error);
            }

            // Set timestamps
            loadingSlip.setCreatedAt(LocalDateTime.now());
            loadingSlip.setUpdatedAt(LocalDateTime.now());

            // Save to database
            LoadingSlip savedSlip = loadingSlipRepository.save(loadingSlip);
            
            // Broadcast to all connected clients via WebSocket
            messagingTemplate.convertAndSend("/topic/loading-slips/created", savedSlip);

            return ResponseEntity.status(HttpStatus.CREATED).body(savedSlip);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to create loading slip: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // Update loading slip
    @PutMapping("/{id}")
    public ResponseEntity<?> updateLoadingSlip(@PathVariable String id, @Valid @RequestBody LoadingSlip loadingSlip) {
        try {
            Optional<LoadingSlip> existingSlipOpt = loadingSlipRepository.findById(id);
            if (!existingSlipOpt.isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Loading slip not found with id: " + id);
                return ResponseEntity.notFound().build();
            }

            LoadingSlip existingSlip = existingSlipOpt.get();
            
            // Check if slip number is being changed and if new number already exists
            if (!existingSlip.getSlipNumber().equals(loadingSlip.getSlipNumber()) &&
                loadingSlipRepository.existsBySlipNumber(loadingSlip.getSlipNumber())) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Loading slip with number " + loadingSlip.getSlipNumber() + " already exists");
                return ResponseEntity.badRequest().body(error);
            }

            // Update fields
            loadingSlip.setId(id);
            loadingSlip.setCreatedAt(existingSlip.getCreatedAt());
            loadingSlip.setUpdatedAt(LocalDateTime.now());

            // Save updated slip
            LoadingSlip updatedSlip = loadingSlipRepository.save(loadingSlip);
            
            // Broadcast to all connected clients via WebSocket
            messagingTemplate.convertAndSend("/topic/loading-slips/updated", updatedSlip);

            return ResponseEntity.ok(updatedSlip);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to update loading slip: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // Delete loading slip
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLoadingSlip(@PathVariable String id) {
        try {
            Optional<LoadingSlip> loadingSlip = loadingSlipRepository.findById(id);
            if (!loadingSlip.isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Loading slip not found with id: " + id);
                return ResponseEntity.notFound().build();
            }

            loadingSlipRepository.deleteById(id);
            
            // Broadcast deletion to all connected clients via WebSocket
            Map<String, String> deletionMessage = new HashMap<>();
            deletionMessage.put("id", id);
            messagingTemplate.convertAndSend("/topic/loading-slips/deleted", deletionMessage);

            Map<String, String> response = new HashMap<>();
            response.put("message", "Loading slip deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to delete loading slip: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // Search loading slips
    @GetMapping("/search")
    public ResponseEntity<List<LoadingSlip>> searchLoadingSlips(@RequestParam String query) {
        // This is a simple search implementation
        // You can extend this to search across multiple fields
        List<LoadingSlip> results = loadingSlipRepository.findByPartyNameContainingIgnoreCase(query);
        
        // Add results from other fields
        results.addAll(loadingSlipRepository.findByVehicleNumberContainingIgnoreCase(query));
        results.addAll(loadingSlipRepository.findByFromLocationContainingIgnoreCase(query));
        results.addAll(loadingSlipRepository.findByToLocationContainingIgnoreCase(query));
        results.addAll(loadingSlipRepository.findByMaterialTypeContainingIgnoreCase(query));
        results.addAll(loadingSlipRepository.findBySupplierDetailContainingIgnoreCase(query));
        
        // Remove duplicates
        results = results.stream().distinct().toList();
        
        return ResponseEntity.ok(results);
    }
}
