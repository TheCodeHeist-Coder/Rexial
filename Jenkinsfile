pipeline{
    
    agent any;
    
    
     triggers {
        githubPush()
    }
    
    stages{
        
        stage("Code Pulling from Github"){
            steps{
                git url: "https://github.com/TheCodeHeist-Coder/Rexial.git", branch: "main"
                echo "Code cloned successfully..."
            }
            
        }
        
        
        
        stage("Build"){
            steps{
                withCredentials([
                    string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL')
                    ]){
                sh ''' 
                DATABASE_URL=$DATABASE_URL docker compose -f docker-compose.prod.yml build
                '''
                    }
            }
            
        }
        
        
        stage("Pushing to Docker Hub"){
            steps{
                withCredentials([
                    usernamePassword(credentialsId: "DockerHubCreds", 
                    passwordVariable: "dockerHubPass",
                    usernameVariable: "dockerHubUser"
                    )
                    ]){
                    sh '''
                     echo $dockerHubPass | docker login -u $dockerHubUser --password-stdin
                     docker push codeheist/rexial-frontend:latest
                     docker push codeheist/rexial-http-server:latest
                     docker push codeheist/rexial-ws-server:latest
                    '''
                }
            }
        }
        
      
        stage("Deploy"){
            steps{
                withCredentials([
                    string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL'),
                    ]){
                sh '''
               docker compose -f docker-compose.prod.yml pull frontend backend ws-server
               DATABASE_URL=$DATABASE_URL docker compose -f docker-compose.prod.yml up -d
                '''
               }
            }
        }


        stage("Cleanup") {               
                sh '''
                docker image prune -f
                docker builder prune -f
                '''
            }
        }


    }
    
    post{
        always{
            sh "docker logout"
        }
        success{
            echo "Deployment Successful....!"
        }
        failure{
            echo "Pipeline failed. Check logs above"
        }
    }
    
    
}